package com.trucoclub.service;

import com.trucoclub.entity.*;
import com.trucoclub.repository.MesaApuestaRepository;
import com.trucoclub.repository.MovimientoRepository;
import com.trucoclub.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Toda la plata de las mesas pasa por acá, siempre dentro de una transacción:
 *
 *  - Crear mesa:   se descuenta la apuesta del creador.
 *  - Cancelarla:   se le devuelve (solo si todavía no entró nadie).
 *  - Entrar:       se descuenta la apuesta del que entra.
 *  - Terminar:     el ganador cobra monto x 2 menos el 5%.
 *  - Al arrancar:  las mesas que quedaron abiertas o a medio jugar se anulan y se devuelve todo.
 *
 * Cada cambio de saldo deja un Movimiento (APUESTA, PREMIO o DEVOLUCION) que el jugador ve en su lista.
 * Orden de bloqueo: siempre primero la mesa y después el usuario (evita bloqueos cruzados).
 */
@Service
public class ApuestaService {

    private static final Set<EstadoMesa> ACTIVAS = EnumSet.of(EstadoMesa.ESPERANDO, EstadoMesa.JUGANDO);

    private final MesaApuestaRepository mesaRepository;
    private final UsuarioRepository usuarioRepository;
    private final MovimientoRepository movimientoRepository;
    private final NotificacionService notificaciones;

    public ApuestaService(MesaApuestaRepository mesaRepository, UsuarioRepository usuarioRepository,
                          MovimientoRepository movimientoRepository, NotificacionService notificaciones) {
        this.mesaRepository = mesaRepository;
        this.usuarioRepository = usuarioRepository;
        this.movimientoRepository = movimientoRepository;
        this.notificaciones = notificaciones;
    }

    /** Descuenta la apuesta del creador y registra la mesa. Devuelve el id de la mesa en la base. */
    @Transactional
    public Long crear(String username, BigDecimal monto, int puntos) {
        if (!MontosMesa.valido(monto)) {
            throw error(HttpStatus.BAD_REQUEST, "Ese monto no es válido para una mesa.");
        }
        Usuario usuario = bloquear(username);
        if (mesaRepository.contarDeUsuario(username, ACTIVAS) > 0) {
            throw error(HttpStatus.CONFLICT, "Ya tenés una mesa abierta o en juego.");
        }
        BigDecimal valor = monto.setScale(2);
        descontar(usuario, valor, "Mesa de " + plata(valor) + " a " + puntos);
        return mesaRepository.save(new MesaApuesta(usuario, valor, puntos)).getId();
    }

    /** El creador cierra la mesa antes de que entre alguien: se le devuelve la apuesta. */
    @Transactional
    public void cancelar(Long mesaId) {
        MesaApuesta mesa = bloquearMesa(mesaId);
        if (mesa.getEstado() != EstadoMesa.ESPERANDO) {
            throw error(HttpStatus.CONFLICT, "La mesa ya empezó, no se puede cancelar.");
        }
        acreditar(bloquear(mesa.getCreador().getUsername()), mesa.getMonto(), TipoMovimiento.DEVOLUCION, "Mesa cancelada");
        mesa.setEstado(EstadoMesa.CANCELADA);
        mesa.setTerminada(Movimiento.ahora());
        mesaRepository.save(mesa);
    }

    /** Descuenta la apuesta del que entra y la mesa pasa a JUGANDO. */
    @Transactional
    public void entrar(Long mesaId, String username) {
        MesaApuesta mesa = bloquearMesa(mesaId);
        if (mesa.getEstado() != EstadoMesa.ESPERANDO) {
            throw error(HttpStatus.CONFLICT, "Alguien ya entró a esa mesa.");
        }
        if (mesa.getCreador().getUsername().equals(username)) {
            throw error(HttpStatus.BAD_REQUEST, "No podés entrar a tu propia mesa.");
        }
        Usuario usuario = bloquear(username);
        if (mesaRepository.contarDeUsuario(username, ACTIVAS) > 0) {
            throw error(HttpStatus.CONFLICT, "Ya tenés una mesa abierta o en juego.");
        }
        descontar(usuario, mesa.getMonto(), "Mesa vs " + mesa.getCreador().getUsername());
        mesa.setRival(usuario);
        mesa.setEstado(EstadoMesa.JUGANDO);
        mesaRepository.save(mesa);
    }

    /** Le paga el premio al ganador. Si ya se pagó (o la mesa no estaba en juego) no hace nada. */
    @Transactional
    public BigDecimal pagarPremio(Long mesaId, String ganador) {
        MesaApuesta mesa = bloquearMesa(mesaId);
        if (mesa.getEstado() != EstadoMesa.JUGANDO) return null;

        String creador = mesa.getCreador().getUsername();
        String rival = mesa.getRival() == null ? "" : mesa.getRival().getUsername();
        if (!ganador.equals(creador) && !ganador.equals(rival)) {
            throw error(HttpStatus.CONFLICT, "El ganador no está en la mesa.");
        }
        BigDecimal premio = MontosMesa.premio(mesa.getMonto());
        String perdedor = ganador.equals(creador) ? rival : creador;
        Usuario uGanador = bloquear(ganador);
        acreditar(uGanador, premio, TipoMovimiento.PREMIO, "Ganaste vs " + perdedor);
        notificaciones.avisar(uGanador, Notificacion.Tipo.PREMIO,
                "¡Ganaste " + Plata.formato(premio) + " contra " + perdedor + "!");

        mesa.setEstado(EstadoMesa.TERMINADA);
        mesa.setGanador(ganador);
        mesa.setGanadorUsuario(uGanador);
        mesa.setPremio(premio);
        mesa.setComision(mesa.getMonto().multiply(BigDecimal.valueOf(2)).subtract(premio));
        mesa.setTerminada(Movimiento.ahora());
        mesaRepository.save(mesa);
        return premio;
    }

    /**
     * Al arrancar el servidor no queda ninguna partida en memoria: las mesas que quedaron abiertas o a
     * medio jugar se anulan y se les devuelve la apuesta a los dos. Devuelve cuántas se anularon.
     */
    @Transactional
    public int anularActivas() {
        List<MesaApuesta> mesas = mesaRepository.findByEstadoIn(ACTIVAS);
        for (MesaApuesta mesa : mesas) {
            String aviso = "Se cortó tu mesa de " + Plata.formato(mesa.getMonto())
                    + " por un reinicio del servidor. Te devolvimos la plata.";
            Usuario creador = bloquear(mesa.getCreador().getUsername());
            acreditar(creador, mesa.getMonto(), TipoMovimiento.DEVOLUCION, "Mesa anulada");
            notificaciones.avisar(creador, Notificacion.Tipo.INFO, aviso);
            if (mesa.getEstado() == EstadoMesa.JUGANDO && mesa.getRival() != null) {
                Usuario rival = bloquear(mesa.getRival().getUsername());
                acreditar(rival, mesa.getMonto(), TipoMovimiento.DEVOLUCION, "Mesa anulada");
                notificaciones.avisar(rival, Notificacion.Tipo.INFO, aviso);
            }
            mesa.setEstado(EstadoMesa.ANULADA);
            mesa.setTerminada(Movimiento.ahora());
            mesaRepository.save(mesa);
        }
        return mesas.size();
    }

    // ------------------------------------------------------------------ ayudas

    private void descontar(Usuario usuario, BigDecimal monto, String detalle) {
        BigDecimal saldo = usuario.getSaldo() == null ? BigDecimal.ZERO : usuario.getSaldo();
        if (saldo.compareTo(monto) < 0) {
            throw error(HttpStatus.CONFLICT, "No te alcanza el saldo para esta mesa.");
        }
        BigDecimal nuevo = saldo.subtract(monto);
        usuario.setSaldo(nuevo);
        usuarioRepository.save(usuario);
        registrar(usuario, TipoMovimiento.APUESTA, monto, nuevo, detalle);
    }

    private void acreditar(Usuario usuario, BigDecimal monto, TipoMovimiento tipo, String detalle) {
        BigDecimal saldo = usuario.getSaldo() == null ? BigDecimal.ZERO : usuario.getSaldo();
        BigDecimal nuevo = saldo.add(monto);
        usuario.setSaldo(nuevo);
        usuarioRepository.save(usuario);
        registrar(usuario, tipo, monto, nuevo, detalle);
    }

    private void registrar(Usuario usuario, TipoMovimiento tipo, BigDecimal monto, BigDecimal saldoDespues, String detalle) {
        Movimiento m = new Movimiento(usuario, tipo, monto, detalle.length() > 60 ? detalle.substring(0, 60) : detalle);
        m.setEstado(EstadoMovimiento.APROBADO);
        m.setResuelto(Movimiento.ahora());
        m.setSaldoDespues(saldoDespues);
        movimientoRepository.save(m);
    }

    private Usuario bloquear(String username) {
        return usuarioRepository.buscarParaActualizarSaldo(username)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "No existe el usuario " + username));
    }

    private MesaApuesta bloquearMesa(Long id) {
        return mesaRepository.buscarParaActualizar(id)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "No existe esa mesa."));
    }

    private static String plata(BigDecimal monto) {
        return "$" + NumberFormat.getIntegerInstance(Locale.forLanguageTag("es-AR")).format(monto);
    }

    private static ResponseStatusException error(HttpStatus status, String mensaje) {
        return new ResponseStatusException(status, mensaje);
    }
}
