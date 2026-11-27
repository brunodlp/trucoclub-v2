package com.trucoclub.service;

import com.trucoclub.dto.AdminUsuario;
import com.trucoclub.dto.AdminUsuario.*;
import com.trucoclub.dto.MovimientoVista;
import com.trucoclub.entity.*;
import com.trucoclub.repository.MesaApuestaRepository;
import com.trucoclub.repository.MovimientoRepository;
import com.trucoclub.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

/** Buscar jugadores, ver su ficha y suspender o reactivar cuentas. */
@Service
public class AdminUsuariosService {

    private static final int MAX_PARTIDAS = 50;

    private final UsuarioRepository usuarioRepository;
    private final MovimientoRepository movimientoRepository;
    private final MesaApuestaRepository mesaRepository;
    private final TrucoService trucoService;
    private final NotificacionService notificaciones;

    public AdminUsuariosService(UsuarioRepository usuarioRepository, MovimientoRepository movimientoRepository,
                                MesaApuestaRepository mesaRepository, TrucoService trucoService,
                                NotificacionService notificaciones) {
        this.usuarioRepository = usuarioRepository;
        this.movimientoRepository = movimientoRepository;
        this.mesaRepository = mesaRepository;
        this.trucoService = trucoService;
        this.notificaciones = notificaciones;
    }

    @Transactional(readOnly = true)
    public List<Resumen> buscar(String texto) {
        String q = texto == null ? "" : texto.trim();
        List<Usuario> lista = q.isEmpty()
                ? usuarioRepository.findTop20ByOrderByIdDesc()
                : usuarioRepository.findTop20ByUsernameContainingIgnoreCaseOrderByUsernameAsc(q);
        return lista.stream().map(AdminUsuariosService::resumen).toList();
    }

    @Transactional(readOnly = true)
    public Detalle detalle(Long id) {
        Usuario u = buscarPorId(id);
        List<MesaApuesta> mesas = mesaRepository.deUsuario(id);

        long jugadas = 0, ganadas = 0;
        BigDecimal apostado = BigDecimal.ZERO, cobrado = BigDecimal.ZERO;
        for (MesaApuesta m : mesas) {
            if (m.getEstado() == EstadoMesa.TERMINADA) {
                jugadas++;
                apostado = apostado.add(m.getMonto());
                if (gano(m, u)) {
                    ganadas++;
                    cobrado = cobrado.add(m.getPremio() == null ? BigDecimal.ZERO : m.getPremio());
                }
            }
        }
        Estadisticas est = new Estadisticas(jugadas, ganadas,
                movimientoRepository.sumarDeUsuario(id, TipoMovimiento.DEPOSITO, EstadoMovimiento.APROBADO),
                movimientoRepository.sumarDeUsuario(id, TipoMovimiento.RETIRO, EstadoMovimiento.APROBADO),
                apostado, cobrado);

        List<MovimientoVista> movimientos = movimientoRepository.findTop100ByUsuarioIdOrderByIdDesc(id).stream()
                .map(MovimientoVista::paraAdmin).toList();
        List<AdminUsuario.Partida> partidas = mesas.stream().limit(MAX_PARTIDAS).map(m -> partida(m, u)).toList();

        return new Detalle(u.getId(), u.getUsername(), u.getEmail(), u.getDni(), u.getFechaRegistro(),
                u.getSaldo() == null ? BigDecimal.ZERO : u.getSaldo(), u.getRol().name(), u.estaBloqueado(),
                u.getMotivoBloqueo(), est, movimientos, partidas);
    }

    /**
     * Suspende la cuenta: no puede entrar ni jugar (las sesiones abiertas se cortan solas).
     * Si tenía una mesa esperando rival, se cancela y se le devuelve la apuesta. El saldo queda guardado.
     */
    public Resumen bloquear(String admin, Long id, String motivo) {
        Usuario u = buscarPorId(id);
        if (u.getUsername().equals(admin)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No podés suspender tu propia cuenta.");
        }
        if (u.esAdmin()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Es admin: primero sacale el rol en la base.");
        }
        trucoService.cancelarMesaEsperandoDe(u.getUsername());
        String texto = motivo == null ? "" : motivo.trim();
        u.setBloqueado(true);
        u.setMotivoBloqueo(texto.isEmpty() ? null : (texto.length() > 200 ? texto.substring(0, 200) : texto));
        System.out.println("[TrucoClub] " + admin + " suspendió a " + u.getUsername());
        return resumen(usuarioRepository.save(u));
    }

    @Transactional
    public Resumen desbloquear(String admin, Long id) {
        Usuario u = buscarPorId(id);
        u.setBloqueado(false);
        u.setMotivoBloqueo(null);
        notificaciones.avisar(u, Notificacion.Tipo.INFO, "Tu cuenta fue reactivada. ¡Bienvenido de nuevo!");
        System.out.println("[TrucoClub] " + admin + " reactivó a " + u.getUsername());
        return resumen(usuarioRepository.save(u));
    }

    // ------------------------------------------------------------------ ayudas

    private Usuario buscarPorId(Long id) {
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No existe ese jugador."));
    }

    private static boolean gano(MesaApuesta m, Usuario u) {
        if (m.getGanadorUsuario() != null) return m.getGanadorUsuario().getId().equals(u.getId());
        return u.getUsername().equals(m.getGanador()); // mesas de antes de guardar el id del ganador
    }

    private static AdminUsuario.Partida partida(MesaApuesta m, Usuario u) {
        boolean soyCreador = m.getCreador().getId().equals(u.getId());
        Usuario otro = soyCreador ? m.getRival() : m.getCreador();
        String resultado = switch (m.getEstado()) {
            case TERMINADA -> gano(m, u) ? "GANO" : "PERDIO";
            default -> m.getEstado().name();
        };
        return new AdminUsuario.Partida(m.getId(), m.getTerminada() != null ? m.getTerminada() : m.getCreada(),
                otro == null ? null : otro.getUsername(), m.getMonto(), m.getPuntos(), resultado,
                "GANO".equals(resultado) ? m.getPremio() : null);
    }

    private static Resumen resumen(Usuario u) {
        return new Resumen(u.getId(), u.getUsername(), u.getSaldo() == null ? BigDecimal.ZERO : u.getSaldo(),
                u.getRol().name(), u.estaBloqueado());
    }
}
