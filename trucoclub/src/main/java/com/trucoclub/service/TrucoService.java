package com.trucoclub.service;

import com.trucoclub.dto.VistaPartida;
import com.trucoclub.entity.HistorialPartida;
import com.trucoclub.entity.Usuario;
import com.trucoclub.model.EstadoJuego;
import com.trucoclub.model.Jugador;
import com.trucoclub.model.MensajeAccion;
import com.trucoclub.model.Partida;
import com.trucoclub.repository.HistorialPartidaRepository;
import com.trucoclub.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Maneja todas las mesas en memoria.
 *
 * Cambios importantes respecto a la versión anterior:
 * - Las mesas viven en un ConcurrentHashMap y cada acción se hace con synchronized sobre la partida:
 *   los mensajes de WebSocket llegan en hilos distintos y dos jugadas al mismo tiempo podían pisarse.
 * - El servidor reparte solo la siguiente mano (antes lo pedían los DOS navegadores a la vez).
 * - Cada jugador recibe su propia vista por su canal personal (/user/queue/partida), sin las cartas del rival.
 * - Las validaciones de turno se hacen acá y no se confía solo en el front.
 */
@Service
public class TrucoService {

    private static final long PAUSA_ENTRE_MANOS_MS = 2750;
    private static final long PAUSA_CON_ENVIDO_MS = 4250; // un poco más para ver las cartas del envido
    public static final long TIEMPO_TURNO_MS = 15000;   // 15 segundos para tirar o responder
    private static final long MARGEN_RED_MS = 700;      // un poquito de margen por la demora de internet
    private static final String LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private static final long LIMPIAR_TERMINADA_MS = 3 * 60 * 1000; // la mesa terminada se borra a los 3 minutos

    /** Lo que devuelve crear/unirse: en qué mesa y en qué silla quedaste. */
    public record MesaInfo(String mesaId, String asiento) {
    }

    /** Datos de la plata de cada mesa (el id es el de la tabla "mesas"). */
    private record Apuesta(Long id, BigDecimal monto, BigDecimal premio, int puntos, String creador, long creadaEn) {
    }

    /** Una mesa esperando rival, como se ve en la sala. */
    public record MesaSala(String mesaId, String creador, BigDecimal monto, BigDecimal premio, int puntos, boolean mia) {
    }

    /** La sala: mesas esperando rival, mi mesa (si estoy esperando), la partida en juego y mi saldo. */
    public record Sala(List<MesaSala> mesas, String esperando, String jugando, BigDecimal saldo) {
    }

    private final Map<String, Partida> partidasActivas = new ConcurrentHashMap<>();
    private final Map<String, Apuesta> apuestas = new ConcurrentHashMap<>();
    private final Set<String> premioPagado = ConcurrentHashMap.newKeySet();
    private final Set<String> historialGuardado = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService reloj = Executors.newSingleThreadScheduledExecutor();
    private final SecureRandom random = new SecureRandom();

    private final SimpMessagingTemplate messaging;
    private final UsuarioRepository usuarioRepository;
    private final HistorialPartidaRepository historialRepository;
    private final ApuestaService apuestaService;

    public TrucoService(SimpMessagingTemplate messaging, UsuarioRepository usuarioRepository,
                        HistorialPartidaRepository historialRepository, ApuestaService apuestaService) {
        this.messaging = messaging;
        this.usuarioRepository = usuarioRepository;
        this.historialRepository = historialRepository;
        this.apuestaService = apuestaService;
    }

    // =====================================================================
    // MESAS
    // =====================================================================

    /** Montos que se pueden elegir y el porcentaje de comisión. */
    public Map<String, Object> opciones() {
        return Map.of("montos", MontosMesa.OPCIONES, "comision", MontosMesa.COMISION_PORCENTAJE);
    }

    /** Lo que ve la pantalla de Mesas. La consulta el front cada 2 segundos. */
    public Sala sala(String usuario) {
        List<MesaSala> mesas = new ArrayList<>();
        String esperando = null;
        String jugando = null;
        for (Map.Entry<String, Partida> e : partidasActivas.entrySet()) {
            Partida p = e.getValue();
            Apuesta a = apuestas.get(e.getKey());
            synchronized (p) {
                EstadoJuego estado = p.getEstadoActual();
                if (estado == EstadoJuego.ESPERANDO_JUGADORES) {
                    if (a == null) continue;
                    boolean mia = a.creador().equals(usuario);
                    if (mia) esperando = e.getKey();
                    mesas.add(new MesaSala(e.getKey(), a.creador(), a.monto(), a.premio(), a.puntos(), mia));
                } else if (estado != EstadoJuego.TERMINADO && asientoDe(p, usuario) != null) {
                    jugando = e.getKey();
                }
            }
        }
        // primero la mía, después las más nuevas
        mesas.sort(Comparator.comparing(MesaSala::mia).reversed()
                .thenComparing(m -> -apuestas.getOrDefault(m.mesaId(), new Apuesta(0L, null, null, 0, "", 0)).creadaEn()));
        BigDecimal saldo = usuarioRepository.findByUsername(usuario)
                .map(u -> u.getSaldo() == null ? BigDecimal.ZERO : u.getSaldo()).orElse(BigDecimal.ZERO);
        return new Sala(mesas, esperando, jugando, saldo);
    }

    /**
     * Crea una mesa con plata: descuenta la apuesta del creador y lo sienta como j1 esperando rival.
     * El creador se queda en la sala hasta que alguien entre.
     */
    public MesaInfo crearMesa(String creador, BigDecimal monto, int puntosMax) {
        if (creador == null || creador.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falta el nombre del jugador");
        }
        if (puntosMax != 15 && puntosMax != 30) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Se juega a 15 o a 30 puntos.");
        }
        // Primero la plata: si no le alcanza o ya tiene una mesa, esto corta acá
        Long apuestaId = apuestaService.crear(creador, monto, puntosMax);
        try {
            Partida partida = new Partida(new Jugador(creador), new Jugador(""), puntosMax);
            partida.esperarRival();
            BigDecimal valor = monto.setScale(2);
            BigDecimal premio = MontosMesa.premio(valor);
            partida.setApuesta(valor, premio);

            String id = reservarCodigo(partida);
            apuestas.put(id, new Apuesta(apuestaId, valor, premio, puntosMax, creador, System.currentTimeMillis()));
            System.out.println("🃏 Mesa " + id + " de $" + valor + " creada por " + creador + " a " + puntosMax);
            return new MesaInfo(id, "j1");
        } catch (RuntimeException e) {
            apuestaService.cancelar(apuestaId); // si algo falló, le devolvemos la plata
            throw e;
        }
    }

    /**
     * Entra a una mesa ajena: descuenta la apuesta y arranca la partida para los dos.
     * Si tenía una mesa propia esperando rival, se cancela (y se le devuelve) antes de entrar.
     * Si ya estaba sentado (recargó la página) le devuelve su silla sin cobrar nada.
     */
    public MesaInfo unirse(String mesaId, String nombre) {
        String id = mesaId == null ? "" : mesaId.trim().toUpperCase();
        Partida partida = buscar(id);
        synchronized (partida) {
            String asiento = asientoDe(partida, nombre);
            if (asiento != null) return new MesaInfo(id, asiento); // reconexión
        }

        // Su propia mesa esperando: se cierra antes (fuera del candado de la otra mesa)
        String propia = mesaEsperandoDe(nombre);
        if (propia != null) cancelarMesa(propia, nombre);

        synchronized (partida) {
            if (!partida.hayLugar()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Alguien ya entró a esa mesa.");
            }
            Apuesta apuesta = apuestas.get(id);
            if (apuesta == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Esa mesa ya no está disponible.");
            }
            apuestaService.entrar(apuesta.id(), nombre); // si no le alcanza el saldo, corta acá
            partida.sentarRival(nombre);
            despuesDeAccion(id, partida, null);
            System.out.println("🤝 " + nombre + " entró a la mesa " + id);
            return new MesaInfo(id, "j2");
        }
    }

    /** El creador cierra su mesa antes de que entre alguien: se le devuelve la apuesta. */
    public void cancelarMesa(String mesaId, String nombre) {
        String id = mesaId == null ? "" : mesaId.trim().toUpperCase();
        Partida partida = buscar(id);
        synchronized (partida) {
            if (!nombre.equals(partida.getJugador1().getNombre())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Esa mesa no es tuya.");
            }
            if (partida.getEstadoActual() != EstadoJuego.ESPERANDO_JUGADORES) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "La mesa ya empezó.");
            }
            Apuesta apuesta = apuestas.get(id);
            if (apuesta != null) apuestaService.cancelar(apuesta.id());
            partidasActivas.remove(id);
            apuestas.remove(id);
            System.out.println("🗑️ Mesa " + id + " cancelada por " + nombre);
        }
    }

    /** Cancela la mesa que el usuario tenga esperando rival (se usa al suspender una cuenta). */
    public void cancelarMesaEsperandoDe(String usuario) {
        String propia = mesaEsperandoDe(usuario);
        if (propia != null) {
            try {
                cancelarMesa(propia, usuario);
            } catch (ResponseStatusException e) {
                // justo entró alguien: la partida sigue y se juega normal
            }
        }
    }

    /**
     * Un jugador abandona. Si la mesa todavía esperaba rival, se cancela y se devuelve la apuesta.
     * Si ya se estaba jugando, el partido termina para los dos y gana (y cobra) el que se quedó.
     */
    public void abandonar(String mesaId, String nombre) {
        String id = mesaId == null ? "" : mesaId.trim().toUpperCase();
        Partida partida = buscar(id);
        synchronized (partida) {
            Jugador jugador = obtenerJugadorPorNombre(partida, nombre);
            if (jugador == null) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No estás sentado en esta mesa");
            }
            if (partida.getEstadoActual() == EstadoJuego.ESPERANDO_JUGADORES) {
                cancelarMesa(id, nombre);
                return;
            }
            if (partida.getEstadoActual() == EstadoJuego.TERMINADO) return;
            partida.abandonar(jugador);
            despuesDeAccion(id, partida, null); // avisa al rival, paga el premio y guarda el historial
        }
    }

    public VistaPartida vista(String mesaId, String nombre) {
        Partida partida = buscar(mesaId);
        synchronized (partida) {
            String asiento = asientoDe(partida, nombre);
            if (asiento == null) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No estás sentado en esta mesa");
            }
            return VistaPartida.de(mesaId, partida, asiento);
        }
    }

    public Partida obtenerPartida(String id) {
        return partidasActivas.get(id);
    }

    // =====================================================================
    // ACCIONES DEL JUEGO
    // =====================================================================

    public Partida jugarCarta(String id, String nombreJugador, int indice) {
        Partida p = partidasActivas.get(id);
        if (p == null) return null;
        synchronized (p) {
            Jugador j = obtenerJugadorPorNombre(p, nombreJugador);
            if (j != null) {
                String antes = firma(p);
                p.realizarJugada(j, indice);
                despuesDeAccion(id, p, antes);
            }
            return p;
        }
    }

    /** Lo dejamos por compatibilidad: ahora el servidor avanza solo, pero si alguien lo llama no rompe nada. */
    public Partida avanzarSiguienteMano(String mesaId) {
        Partida partida = obtenerPartida(mesaId);
        if (partida == null) return null;
        synchronized (partida) {
            String antes = firma(partida);
            partida.avanzarSiguienteMano(); // tiene candado: solo avanza si estaba ENTRE_MANOS
            despuesDeAccion(mesaId, partida, antes);
            return partida;
        }
    }

    // --- LÓGICA DE GRITOS (Envido, Truco, Mazo) ---
    public Partida procesarCanto(MensajeAccion mensaje) {
        Partida partida = obtenerPartida(mensaje.getMesaId());
        if (partida == null || mensaje.getAccion() == null) return null;

        synchronized (partida) {
            Jugador jugador = obtenerJugadorPorNombre(partida, mensaje.getNombreJugador());
            if (jugador == null) return partida;

            String antes = firma(partida);
            String accion = mensaje.getAccion().toLowerCase().trim();
            EstadoJuego estado = partida.getEstadoActual();
            boolean esMiTurno = estado == EstadoJuego.ESPERANDO_CARTA && partida.getTurnoActual() == jugador;

            // Regla del 4: en la tercera baza, si el rival te tiró un 4, no podés cantar nada, solo tirar carta
            if (esMiTurno && partida.cartaEnMesaEsCuatro()) {
                System.out.println("⚠️ Te tiraron un 4: solo podés tirar carta.");
                return partida;
            }

            switch (accion) {
                case "irse_al_mazo" -> {
                    // Al mazo: en tu turno, o en vez de contestar un truco
                    boolean respondiendoTruco = estado == EstadoJuego.ESPERANDO_RESPUESTA_TRUCO
                            && partida.getQuienDebeResponder() == jugador;
                    if (esMiTurno || respondiendoTruco) partida.irseAlMazo(jugador);
                }
                case "envido", "real envido", "falta envido" -> {
                    if (esMiTurno) partida.cantarEnvido(jugador, accion);
                }
                case "truco", "retruco", "vale cuatro" -> {
                    if (esMiTurno) partida.cantarTruco(jugador, accion);
                }
                default -> System.out.println("⚠️ Canto desconocido: " + accion);
            }

            despuesDeAccion(mensaje.getMesaId(), partida, antes);
            return partida;
        }
    }

    // --- LÓGICA DE RESPUESTAS (Quiero, No quiero, Retruco) ---
    public Partida procesarRespuesta(MensajeAccion mensaje) {
        Partida partida = obtenerPartida(mensaje.getMesaId());
        if (partida == null || mensaje.getAccion() == null) return null;

        synchronized (partida) {
            Jugador jugador = obtenerJugadorPorNombre(partida, mensaje.getNombreJugador());
            if (jugador == null) return partida;

            String antes = firma(partida);
            partida.responder(jugador, mensaje.getAccion().toLowerCase().trim());
            despuesDeAccion(mensaje.getMesaId(), partida, antes);
            return partida;
        }
    }

    // =====================================================================
    // DESPUÉS DE CADA ACCIÓN: avisar, repartir solo y guardar historial
    // =====================================================================

    /**
     * Siempre se llama con el lock de la partida tomado.
     * @param firmaAntes cómo estaba la mesa antes de la acción (null = cambió seguro).
     *                   Si la acción fue inválida y no cambió nada, no reiniciamos el reloj
     *                   (si no, alguien podría mandar acciones inválidas para ganar tiempo).
     */
    private void despuesDeAccion(String mesaId, Partida partida, String firmaAntes) {
        boolean cambio = firmaAntes == null || !firmaAntes.equals(firma(partida));

        if (cambio) {
            partida.incrementarVersion();
            long extra = partida.consumirTiempoExtra(); // ej: después del envido, el tiempo de las nubes
            if (partida.esperaAccion()) {
                long duracion = TIEMPO_TURNO_MS + extra;
                partida.setVenceTurnoEn(System.currentTimeMillis() + duracion);
                programarTiempoAgotado(mesaId, partida, partida.getVersionAccion(), duracion);
            } else {
                partida.setVenceTurnoEn(0);
            }
        }

        publicar(mesaId, partida);

        if (!cambio) return;
        if (partida.getEstadoActual() == EstadoJuego.ENTRE_MANOS) {
            programarSiguienteMano(mesaId, partida, partida.getNumeroRonda());
        } else if (partida.getEstadoActual() == EstadoJuego.TERMINADO) {
            pagarPremio(mesaId, partida);
            guardarHistorial(mesaId, partida);
            programarLimpieza(mesaId);
        }
    }

    /** Si en 15 segundos nadie hizo nada, actúa solo: al mazo o "no quiero". */
    private void programarTiempoAgotado(String mesaId, Partida partida, int version, long duracionMs) {
        reloj.schedule(() -> {
            try {
                synchronized (partida) {
                    // Solo si desde entonces no pasó nada en la mesa
                    if (partida.getVersionAccion() == version && partida.esperaAccion()) {
                        System.out.println("⏰ Se acabó el tiempo en la mesa " + mesaId);
                        partida.tiempoAgotado();
                        despuesDeAccion(mesaId, partida, null);
                    }
                }
            } catch (RuntimeException e) {
                System.out.println("⚠️ Error en el reloj de la mesa " + mesaId + ": " + e.getMessage());
            }
        }, duracionMs + MARGEN_RED_MS, TimeUnit.MILLISECONDS);
    }

    /** Resumen del estado para saber si una acción cambió algo. */
    private String firma(Partida p) {
        return p.getEstadoActual() + "|" + p.getNumeroRonda() + "|" + p.getCantoSeq() + "|"
                + p.getJugador1().getMano().size() + "|" + p.getJugador2().getMano().size() + "|"
                + p.getJugador1().getPuntos() + "|" + p.getJugador2().getPuntos() + "|"
                + (p.getTurnoActual() == null ? "-" : p.getTurnoActual().getNombre()) + "|"
                + (p.getQuienDebeResponder() == null ? "-" : p.getQuienDebeResponder().getNombre());
    }

    private void programarSiguienteMano(String mesaId, Partida partida, int ronda) {
        reloj.schedule(() -> {
            try {
                synchronized (partida) {
                    // Solo si seguimos en la misma pausa (evita repartir dos veces)
                    if (partida.getEstadoActual() == EstadoJuego.ENTRE_MANOS && partida.getNumeroRonda() == ronda) {
                        partida.avanzarSiguienteMano();
                        despuesDeAccion(mesaId, partida, null);
                    }
                }
            } catch (RuntimeException e) {
                System.out.println("⚠️ Error repartiendo en la mesa " + mesaId + ": " + e.getMessage());
            }
        }, partida.getEnvidoMostrar() != null ? PAUSA_CON_ENVIDO_MS : PAUSA_ENTRE_MANOS_MS, TimeUnit.MILLISECONDS);
    }

    /**
     * Le manda a cada jugador SU vista de la partida, por su canal personal (/user/queue/partida).
     * Solo la conexión autenticada como ese usuario puede recibirla: nadie puede espiar las cartas del otro.
     */
    private void publicar(String mesaId, Partida partida) {
        messaging.convertAndSendToUser(partida.getJugador1().getNombre(), "/queue/partida", VistaPartida.de(mesaId, partida, "j1"));
        if (partida.getEstadoActual() != EstadoJuego.ESPERANDO_JUGADORES) {
            messaging.convertAndSendToUser(partida.getJugador2().getNombre(), "/queue/partida", VistaPartida.de(mesaId, partida, "j2"));
        }
    }

    /** El ganador es el que marca la partida (por puntos o porque el otro abandonó). */
    private Jugador ganadorDe(Partida partida) {
        if (partida.getGanadorPartido() != null) {
            return partida.getGanadorPartido().equals(partida.getJugador1().getNombre())
                    ? partida.getJugador1() : partida.getJugador2();
        }
        return partida.getJugador1().getPuntos() >= partida.getJugador2().getPuntos()
                ? partida.getJugador1() : partida.getJugador2();
    }

    /** Le acredita el premio al ganador (una sola vez por mesa). */
    private void pagarPremio(String mesaId, Partida partida) {
        Apuesta apuesta = apuestas.get(mesaId);
        if (apuesta == null || !premioPagado.add(mesaId)) return;
        String ganador = ganadorDe(partida).getNombre();
        try {
            BigDecimal premio = apuestaService.pagarPremio(apuesta.id(), ganador);
            System.out.println("💰 Mesa " + mesaId + ": " + ganador + " cobra $" + premio);
        } catch (RuntimeException e) {
            premioPagado.remove(mesaId);
            System.out.println("⚠️ No se pudo pagar el premio de la mesa " + mesaId + ": " + e.getMessage());
        }
    }

    /** Pasados unos minutos, la mesa terminada se borra de memoria (ya se vio el cartel final). */
    private void programarLimpieza(String mesaId) {
        reloj.schedule(() -> {
            partidasActivas.remove(mesaId);
            apuestas.remove(mesaId);
            premioPagado.remove(mesaId);
            historialGuardado.remove(mesaId);
        }, LIMPIAR_TERMINADA_MS, TimeUnit.MILLISECONDS);
    }

    private void guardarHistorial(String mesaId, Partida partida) {
        if (!historialGuardado.add(mesaId)) return; // ya se guardó
        try {
            Jugador ganador = ganadorDe(partida);
            Jugador perdedor = ganador == partida.getJugador1() ? partida.getJugador2() : partida.getJugador1();

            Optional<Usuario> uGanador = usuarioRepository.findByUsername(ganador.getNombre());
            Optional<Usuario> uPerdedor = usuarioRepository.findByUsername(perdedor.getNombre());
            if (uGanador.isEmpty() || uPerdedor.isEmpty()) return; // partidas de prueba sin usuarios reales

            HistorialPartida h = new HistorialPartida();
            h.setGanador(uGanador.get());
            h.setPerdedor(uPerdedor.get());
            h.setPuntosGanador(ganador.getPuntos());
            h.setPuntosPerdedor(perdedor.getPuntos());
            historialRepository.save(h);

            Usuario u = uGanador.get();
            u.setPartidasGanadas((u.getPartidasGanadas() == null ? 0 : u.getPartidasGanadas()) + 1);
            usuarioRepository.save(u);
            System.out.println("💾 Historial guardado: ganó " + ganador.getNombre());
        } catch (RuntimeException e) {
            // Si la base falla no queremos romper el partido
            System.out.println("⚠️ No se pudo guardar el historial: " + e.getMessage());
        }
    }

    // =====================================================================
    // AUXILIARES
    // =====================================================================

    private Partida buscar(String mesaId) {
        Partida partida = mesaId == null ? null : partidasActivas.get(mesaId.trim().toUpperCase());
        if (partida == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe la mesa " + mesaId);
        }
        return partida;
    }

    private String asientoDe(Partida partida, String nombre) {
        if (nombre == null) return null;
        if (nombre.equals(partida.getJugador1().getNombre())) return "j1";
        if (nombre.equals(partida.getJugador2().getNombre())) return "j2";
        return null;
    }

    private Jugador obtenerJugadorPorNombre(Partida partida, String nombre) {
        if (nombre == null || nombre.isEmpty()) return null;
        if (partida.getJugador1().getNombre().equals(nombre)) return partida.getJugador1();
        if (partida.getJugador2().getNombre().equals(nombre)) return partida.getJugador2();
        return null;
    }

    /** La mesa que el usuario creó y sigue esperando rival (o null). */
    private String mesaEsperandoDe(String usuario) {
        for (Map.Entry<String, Partida> e : partidasActivas.entrySet()) {
            Partida p = e.getValue();
            synchronized (p) {
                if (p.getEstadoActual() == EstadoJuego.ESPERANDO_JUGADORES && usuario.equals(p.getJugador1().getNombre())) {
                    return e.getKey();
                }
            }
        }
        return null;
    }

    /** Guarda la partida con un código interno corto que no esté usado, ej: "K7QX". */
    private String reservarCodigo(Partida partida) {
        while (true) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 4; i++) sb.append(LETRAS.charAt(random.nextInt(LETRAS.length())));
            String codigo = sb.toString();
            if (partidasActivas.putIfAbsent(codigo, partida) == null) return codigo;
        }
    }
}
