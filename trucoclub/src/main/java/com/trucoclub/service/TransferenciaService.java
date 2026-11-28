package com.trucoclub.service;

import com.trucoclub.dto.TransferenciaVista;
import com.trucoclub.entity.*;
import com.trucoclub.entity.TransferenciaEntrante.Estado;
import com.trucoclub.repository.MovimientoRepository;
import com.trucoclub.repository.TransferenciaEntranteRepository;
import com.trucoclub.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Depósitos automáticos: cada transferencia que entra a la cuenta del sitio se registra acá.
 *
 *  1. Del CUIT/CUIL de quien transfirió se saca el DNI (20-30123456-7 -> 30123456).
 *  2. Si hay un jugador con ese DNI, se le acredita el monto que entró (sin que declare nada).
 *  3. Si no hay nadie (o la cuenta está suspendida), queda SIN_IDENTIFICAR para que un admin
 *     la asigne a un jugador o la marque como devuelta.
 *
 * Cada transferencia trae un id único del banco: si el mismo aviso llega dos veces (los proveedores
 * reintentan cuando no reciben respuesta), la segunda vez no se acredita de nuevo.
 */
@Service
public class TransferenciaService {

    private final TransferenciaEntranteRepository repo;
    private final UsuarioRepository usuarioRepository;
    private final MovimientoRepository movimientoRepository;
    private final NotificacionService notificaciones;

    public TransferenciaService(TransferenciaEntranteRepository repo, UsuarioRepository usuarioRepository,
                                MovimientoRepository movimientoRepository, NotificacionService notificaciones) {
        this.repo = repo;
        this.usuarioRepository = usuarioRepository;
        this.movimientoRepository = movimientoRepository;
        this.notificaciones = notificaciones;
    }

    /** Resultado de registrar: la transferencia y si era un aviso repetido. */
    public record Resultado(TransferenciaVista transferencia, boolean repetida) {
    }

    /**
     * Registra una transferencia entrante (desde el webhook del banco o cargada por un admin).
     * synchronized: con un solo servidor alcanza para que dos avisos iguales simultáneos no pasen los dos;
     * además la base tiene id_externo único como respaldo.
     */
    @Transactional
    public synchronized Resultado registrar(String proveedor, String idExterno, BigDecimal monto, String cuit,
                                            String nombre) {
        if (idExterno == null || idExterno.isBlank()) throw error(HttpStatus.BAD_REQUEST, "Falta el id de la transferencia.");
        if (monto == null || monto.signum() <= 0) throw error(HttpStatus.BAD_REQUEST, "El monto tiene que ser mayor a 0.");
        if (monto.stripTrailingZeros().scale() > 2) throw error(HttpStatus.BAD_REQUEST, "El monto puede tener como mucho 2 decimales.");

        String id = idExterno.trim();
        Optional<TransferenciaEntrante> ya = repo.findByIdExterno(id);
        if (ya.isPresent()) return new Resultado(TransferenciaVista.de(ya.get()), true); // aviso repetido: no se toca nada

        String cuitLimpio = soloNumeros(cuit);
        String dni = dniDeCuit(cuitLimpio);

        TransferenciaEntrante t = new TransferenciaEntrante();
        t.setIdExterno(id);
        t.setProveedor(proveedor);
        t.setMonto(monto.setScale(2));
        t.setCuitOriginante(cuitLimpio.isEmpty() ? null : cuitLimpio);
        t.setNombreOriginante(recortar(nombre, 120));
        t.setDniDetectado(dni);

        Optional<Usuario> jugador = buscarPorDni(dni);
        if (jugador.isPresent() && !jugador.get().estaBloqueado()) {
            acreditar(t, jugador.get(), Estado.ACREDITADA, "automático");
        } else {
            t.setEstado(Estado.SIN_IDENTIFICAR);
            if (jugador.isPresent()) t.setNota("El DNI es de " + jugador.get().getUsername() + ", que está suspendido.");
            else if (dni == null) t.setNota("La transferencia no trae CUIT/CUIL.");
            else t.setNota("Ningún jugador tiene el DNI " + dni + ".");
        }
        return new Resultado(TransferenciaVista.de(repo.save(t)), false);
    }

    /** Un admin acredita una transferencia sin identificar a un jugador elegido. */
    @Transactional
    public TransferenciaVista asignar(String admin, Long id, Long usuarioId) {
        TransferenciaEntrante t = pendienteBloqueada(id);
        Usuario u = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "No existe ese jugador."));
        acreditar(t, u, Estado.ASIGNADA, admin);
        return TransferenciaVista.de(repo.save(t));
    }

    /** Un admin marca que devolvió la plata a quien la mandó (no se acredita a nadie). */
    @Transactional
    public TransferenciaVista marcarDevuelta(String admin, Long id, String nota) {
        TransferenciaEntrante t = pendienteBloqueada(id);
        t.setEstado(Estado.DEVUELTA);
        t.setResuelta(Movimiento.ahora());
        t.setResueltoPor(admin);
        String texto = nota == null ? "" : nota.trim();
        if (!texto.isEmpty()) t.setNota(recortar(texto, 200));
        return TransferenciaVista.de(repo.save(t));
    }

    @Transactional(readOnly = true)
    public List<TransferenciaVista> sinIdentificar() {
        return repo.findByEstadoOrderByIdAsc(Estado.SIN_IDENTIFICAR).stream().map(TransferenciaVista::de).toList();
    }

    @Transactional(readOnly = true)
    public List<TransferenciaVista> recientes() {
        return repo.findTop100ByOrderByIdDesc().stream().map(TransferenciaVista::de).toList();
    }

    // ------------------------------------------------------------------ ayudas

    /** Suma el monto al saldo del jugador, deja el movimiento de DEPÓSITO aprobado y le avisa. */
    private void acreditar(TransferenciaEntrante t, Usuario jugador, Estado estado, String quien) {
        Usuario u = usuarioRepository.buscarParaActualizarSaldo(jugador.getUsername())
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "No existe el jugador."));
        BigDecimal nuevo = (u.getSaldo() == null ? BigDecimal.ZERO : u.getSaldo()).add(t.getMonto());
        u.setSaldo(nuevo);
        usuarioRepository.save(u);

        String origen = t.getNombreOriginante() != null ? t.getNombreOriginante()
                : t.getCuitOriginante() != null ? "CUIT " + t.getCuitOriginante() : "transferencia";
        Movimiento m = new Movimiento(u, TipoMovimiento.DEPOSITO, t.getMonto(), recortar("Transferencia de " + origen, 60));
        m.setEstado(EstadoMovimiento.APROBADO);
        m.setResuelto(Movimiento.ahora());
        m.setResueltoPor(quien);
        m.setSaldoDespues(nuevo);
        movimientoRepository.save(m);

        notificaciones.avisar(u, Notificacion.Tipo.OK, "Te acreditamos tu depósito de " + Plata.formato(t.getMonto()) + ".");

        t.setEstado(estado);
        t.setUsuario(u);
        t.setMovimiento(m);
        t.setResuelta(Movimiento.ahora());
        t.setResueltoPor(quien);
    }

    private TransferenciaEntrante pendienteBloqueada(Long id) {
        TransferenciaEntrante t = repo.buscarParaResolver(id)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "No existe esa transferencia."));
        if (t.getEstado() != Estado.SIN_IDENTIFICAR) {
            throw error(HttpStatus.CONFLICT, "Esa transferencia ya fue resuelta.");
        }
        return t;
    }

    /** Busca el jugador por DNI (los guardados con 7 dígitos pueden venir con un 0 adelante en el CUIL). */
    private Optional<Usuario> buscarPorDni(String dni) {
        if (dni == null) return Optional.empty();
        Optional<Usuario> u = usuarioRepository.findByDni(dni);
        if (u.isEmpty() && dni.length() == 7) u = usuarioRepository.findByDni("0" + dni);
        return u;
    }

    /**
     * DNI a partir del CUIT/CUIL: 11 dígitos = 2 de tipo + 8 de DNI + 1 verificador.
     * Si ya viene un DNI (7 u 8 dígitos) se usa tal cual. Se sacan los ceros de adelante.
     * Las empresas (CUIT 30-, 33-, 34-) no tienen DNI.
     */
    public static String dniDeCuit(String cuit) {
        String n = soloNumeros(cuit);
        String dni;
        if (n.length() == 11) {
            String tipo = n.substring(0, 2);
            if (tipo.equals("30") || tipo.equals("33") || tipo.equals("34")) return null; // persona jurídica
            dni = n.substring(2, 10);
        } else if (n.length() == 7 || n.length() == 8) {
            dni = n;
        } else {
            return null;
        }
        dni = dni.replaceFirst("^0+", "");
        return dni.length() >= 6 ? dni : null;
    }

    private static String soloNumeros(String s) {
        return s == null ? "" : s.replaceAll("[^0-9]", "");
    }

    private static String recortar(String s, int max) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static ResponseStatusException error(HttpStatus status, String mensaje) {
        return new ResponseStatusException(status, mensaje);
    }
}
