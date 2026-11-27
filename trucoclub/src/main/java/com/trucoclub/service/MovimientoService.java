package com.trucoclub.service;

import com.trucoclub.dto.DatosPagos;
import com.trucoclub.dto.MovimientoVista;
import com.trucoclub.entity.EstadoMovimiento;
import com.trucoclub.entity.Notificacion;
import com.trucoclub.entity.Movimiento;
import com.trucoclub.entity.TipoMovimiento;
import com.trucoclub.entity.Usuario;
import com.trucoclub.repository.MovimientoRepository;
import com.trucoclub.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Depósitos y retiros con aprobación manual.
 *
 *  - DEPÓSITO: el jugador transfiere a la cuenta del sitio y carga el pedido con el número de
 *    operación. El saldo NO cambia hasta que un admin verifica que la plata llegó y lo aprueba.
 *  - RETIRO: al pedirlo, la plata se descuenta del saldo en el momento (queda "reservada"), así
 *    no se puede apostar ni pedir dos veces. El admin transfiere a mano y lo aprueba. Si lo
 *    rechaza, o el jugador lo cancela, la plata vuelve al saldo.
 *
 * Cada operación que toca el saldo bloquea la fila del usuario (y la del movimiento) hasta terminar,
 * así dos pedidos simultáneos no se pisan. Si algo falla en el medio, @Transactional deshace todo.
 */
@Service
public class MovimientoService {

    private static final int MAX_DEPOSITOS_PENDIENTES = 3;
    private static final Pattern ALIAS = Pattern.compile("[A-Za-z0-9.\\-]{6,20}");
    private static final Pattern CBU = Pattern.compile("\\d{22}");
    private static final Pattern OPERACION = Pattern.compile("[A-Za-z0-9\\-]{4,40}");

    private final MovimientoRepository movimientoRepository;
    private final UsuarioRepository usuarioRepository;
    private final DatosPagos datosPagos;
    private final NotificacionService notificaciones;

    public MovimientoService(MovimientoRepository movimientoRepository,
                             UsuarioRepository usuarioRepository,
                             NotificacionService notificaciones,
                             @Value("${trucoclub.pagos.alias:}") String alias,
                             @Value("${trucoclub.pagos.cbu:}") String cbu,
                             @Value("${trucoclub.pagos.titular:}") String titular,
                             @Value("${trucoclub.pagos.minimo-deposito:500}") BigDecimal minimoDeposito,
                             @Value("${trucoclub.pagos.minimo-retiro:1000}") BigDecimal minimoRetiro,
                             @Value("${trucoclub.pagos.maximo:1000000}") BigDecimal maximo,
                             @Value("${trucoclub.pagos.retiros-por-dia:2}") int retirosPorDia) {
        this.movimientoRepository = movimientoRepository;
        this.usuarioRepository = usuarioRepository;
        this.notificaciones = notificaciones;
        this.datosPagos = new DatosPagos(alias, cbu, titular, minimoDeposito, minimoRetiro, maximo, retirosPorDia);
    }

    public DatosPagos datosPagos() {
        return datosPagos;
    }

    // ------------------------------------------------------------------ jugador

    @Transactional(readOnly = true)
    public List<MovimientoVista> deUsuario(String username) {
        return movimientoRepository.findTop100ByUsuarioUsernameOrderByIdDesc(username).stream()
                .map(MovimientoVista::paraUsuario).toList();
    }

    @Transactional
    public MovimientoVista pedirDeposito(String username, BigDecimal monto, String operacion) {
        BigDecimal valor = validarMonto(monto, datosPagos.minimoDeposito());
        String detalle = limpiar(operacion);
        if (!OPERACION.matcher(detalle).matches()) {
            throw error(HttpStatus.BAD_REQUEST, "Poné el número de operación de la transferencia (solo letras y números).");
        }
        if (movimientoRepository.countByUsuarioUsernameAndTipoAndEstado(username, TipoMovimiento.DEPOSITO, EstadoMovimiento.PENDIENTE)
                >= MAX_DEPOSITOS_PENDIENTES) {
            throw error(HttpStatus.CONFLICT, "Ya tenés " + MAX_DEPOSITOS_PENDIENTES + " depósitos esperando revisión. Esperá a que los aprueben.");
        }
        Usuario usuario = usuarioRepository.findByUsername(username)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "No existe el usuario"));
        exigirDni(usuario);
        Movimiento m = new Movimiento(usuario, TipoMovimiento.DEPOSITO, valor, detalle);
        return MovimientoVista.paraUsuario(movimientoRepository.save(m));
    }

    @Transactional
    public MovimientoVista pedirRetiro(String username, BigDecimal monto, String destino) {
        BigDecimal valor = validarMonto(monto, datosPagos.minimoRetiro());
        String detalle = limpiar(destino);
        if (!ALIAS.matcher(detalle).matches() && !CBU.matcher(detalle).matches()) {
            throw error(HttpStatus.BAD_REQUEST, "Poné un alias (6 a 20 letras, números o puntos) o un CBU/CVU de 22 números.");
        }
        Usuario usuario = usuarioRepository.buscarParaActualizarSaldo(username)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "No existe el usuario"));
        exigirDni(usuario);
        // Máximo de retiros por día (cuentan los pendientes y los aprobados; los cancelados y rechazados no).
        // Se cuenta con la fila del usuario bloqueada, así dos pedidos a la vez no pasan los dos.
        long hoy = movimientoRepository.countByUsuarioUsernameAndTipoAndEstadoInAndCreadoGreaterThanEqual(username,
                TipoMovimiento.RETIRO, List.of(EstadoMovimiento.PENDIENTE, EstadoMovimiento.APROBADO),
                Movimiento.ahora().toLocalDate().atStartOfDay());
        if (hoy >= datosPagos.retirosPorDia()) {
            throw error(HttpStatus.CONFLICT, "Podés pedir hasta " + datosPagos.retirosPorDia()
                    + " retiros por día. Probá de nuevo mañana.");
        }
        BigDecimal saldo = saldoDe(usuario);
        if (saldo.compareTo(valor) < 0) {
            throw error(HttpStatus.CONFLICT, "No te alcanza el saldo para retirar ese monto.");
        }
        BigDecimal nuevo = saldo.subtract(valor);
        usuario.setSaldo(nuevo);
        usuarioRepository.save(usuario);

        Movimiento m = new Movimiento(usuario, TipoMovimiento.RETIRO, valor, detalle);
        m.setSaldoDespues(nuevo);
        return MovimientoVista.paraUsuario(movimientoRepository.save(m));
    }

    /** El jugador cancela un pedido suyo que todavía no revisaron. Si era un retiro, recupera la plata. */
    @Transactional
    public MovimientoVista cancelar(String username, Long id) {
        Movimiento m = pendienteBloqueado(id);
        if (!m.getUsuario().getUsername().equals(username)) {
            throw error(HttpStatus.NOT_FOUND, "No existe ese movimiento.");
        }
        if (m.getTipo() == TipoMovimiento.RETIRO) devolverAlSaldo(m);
        m.setEstado(EstadoMovimiento.CANCELADO);
        m.setResuelto(Movimiento.ahora());
        return MovimientoVista.paraUsuario(movimientoRepository.save(m));
    }

    // ------------------------------------------------------------------ admin

    @Transactional(readOnly = true)
    public List<MovimientoVista> pendientes() {
        return movimientoRepository.findByEstadoOrderByIdAsc(EstadoMovimiento.PENDIENTE).stream()
                .map(MovimientoVista::paraAdmin).toList();
    }

    @Transactional(readOnly = true)
    public List<MovimientoVista> resueltos() {
        return movimientoRepository.findTop100ByEstadoNotAndTipoInOrderByIdDesc(EstadoMovimiento.PENDIENTE,
                        List.of(TipoMovimiento.DEPOSITO, TipoMovimiento.RETIRO)).stream()
                .map(MovimientoVista::paraAdmin).toList();
    }

    /**
     * Depósito: el admin confirmó que la transferencia llegó → se suma al saldo.
     * Retiro: el admin ya transfirió → la plata ya estaba descontada, solo se marca como hecho.
     */
    @Transactional
    public MovimientoVista aprobar(String admin, Long id) {
        Movimiento m = pendienteBloqueado(id);
        if (m.getTipo() == TipoMovimiento.DEPOSITO) {
            Usuario usuario = bloquearUsuario(m);
            BigDecimal nuevo = saldoDe(usuario).add(m.getMonto());
            usuario.setSaldo(nuevo);
            usuarioRepository.save(usuario);
            m.setSaldoDespues(nuevo);
            notificaciones.avisar(usuario, Notificacion.Tipo.OK,
                    "Te acreditamos tu depósito de " + Plata.formato(m.getMonto()) + ".");
        } else {
            notificaciones.avisar(m.getUsuario(), Notificacion.Tipo.OK,
                    "Te transferimos tu retiro de " + Plata.formato(m.getMonto()) + " a " + m.getDetalle() + ".");
        }
        return cerrar(m, EstadoMovimiento.APROBADO, admin, null);
    }

    /** Rechazar: el depósito no llegó o el retiro no se puede hacer. Si era un retiro, la plata vuelve. */
    @Transactional
    public MovimientoVista rechazar(String admin, Long id, String motivo) {
        Movimiento m = pendienteBloqueado(id);
        if (m.getTipo() == TipoMovimiento.RETIRO) devolverAlSaldo(m);
        String texto = motivo == null ? "" : motivo.trim();
        if (texto.length() > 200) texto = texto.substring(0, 200);
        boolean retiro = m.getTipo() == TipoMovimiento.RETIRO;
        notificaciones.avisar(m.getUsuario(), Notificacion.Tipo.ERROR,
                "Rechazamos tu " + (retiro ? "retiro" : "depósito") + " de " + Plata.formato(m.getMonto())
                        + (texto.isEmpty() ? "." : ": " + texto + (texto.endsWith(".") ? "" : "."))
                        + (retiro ? " La plata volvió a tu saldo." : ""));
        return cerrar(m, EstadoMovimiento.RECHAZADO, admin, texto.isEmpty() ? null : texto);
    }

    // ------------------------------------------------------------------ ayudas

    private MovimientoVista cerrar(Movimiento m, EstadoMovimiento estado, String admin, String motivo) {
        m.setEstado(estado);
        m.setResuelto(Movimiento.ahora());
        m.setResueltoPor(admin);
        m.setMotivoRechazo(motivo);
        return MovimientoVista.paraAdmin(movimientoRepository.save(m));
    }

    /** Siempre se bloquea primero el movimiento y después el usuario (mismo orden en todos lados = sin bloqueos cruzados). */
    private Movimiento pendienteBloqueado(Long id) {
        Movimiento m = movimientoRepository.buscarParaResolver(id)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "No existe ese movimiento."));
        if (m.getEstado() != EstadoMovimiento.PENDIENTE) {
            throw error(HttpStatus.CONFLICT, "Ese movimiento ya fue resuelto (" + m.getEstado().name().toLowerCase() + ").");
        }
        return m;
    }

    private Usuario bloquearUsuario(Movimiento m) {
        return usuarioRepository.buscarParaActualizarSaldo(m.getUsuario().getUsername())
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "No existe el usuario"));
    }

    private void devolverAlSaldo(Movimiento m) {
        Usuario usuario = bloquearUsuario(m);
        BigDecimal nuevo = saldoDe(usuario).add(m.getMonto());
        usuario.setSaldo(nuevo);
        usuarioRepository.save(usuario);
        m.setSaldoDespues(nuevo);
    }

    private BigDecimal validarMonto(BigDecimal monto, BigDecimal minimo) {
        if (monto == null) throw error(HttpStatus.BAD_REQUEST, "Poné un monto.");
        if (monto.stripTrailingZeros().scale() > 2) throw error(HttpStatus.BAD_REQUEST, "El monto puede tener como mucho 2 decimales.");
        if (monto.compareTo(minimo) < 0) throw error(HttpStatus.BAD_REQUEST, "El monto mínimo es $" + minimo.toPlainString() + ".");
        if (monto.compareTo(datosPagos.maximo()) > 0) throw error(HttpStatus.BAD_REQUEST, "El monto máximo es $" + datosPagos.maximo().toPlainString() + ".");
        return monto.setScale(2);
    }

    /** Sin DNI no se puede verificar al titular de la transferencia. */
    private static void exigirDni(Usuario u) {
        if (u.getDni() == null || u.getDni().isBlank()) {
            throw error(HttpStatus.CONFLICT, "Cargá tu DNI antes de depositar o retirar.");
        }
    }

    private static BigDecimal saldoDe(Usuario u) {
        return u.getSaldo() == null ? BigDecimal.ZERO : u.getSaldo();
    }

    private static String limpiar(String s) {
        return s == null ? "" : s.trim().replaceAll("\\s+", "");
    }

    private static ResponseStatusException error(HttpStatus status, String mensaje) {
        return new ResponseStatusException(status, mensaje);
    }
}
