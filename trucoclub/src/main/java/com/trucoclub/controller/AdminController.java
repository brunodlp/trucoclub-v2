package com.trucoclub.controller;

import com.trucoclub.dto.AdminUsuario;
import com.trucoclub.dto.Ganancias;
import com.trucoclub.dto.TransferenciaVista;
import com.trucoclub.service.TransferenciaService;
import com.trucoclub.service.AdminUsuariosService;
import com.trucoclub.dto.MovimientoVista;
import com.trucoclub.service.GananciasService;
import com.trucoclub.seguridad.AuthInterceptor;
import com.trucoclub.service.MovimientoService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

/**
 * Panel de admin. Todo /api/admin/** pasa primero por AuthInterceptor (token válido) y después
 * por AdminInterceptor (el usuario tiene rol ADMIN en la base). Si no, 401 o 403.
 *
 *  GET  /api/admin/movimientos?estado=PENDIENTE   -> pendientes (el más viejo primero)
 *  GET  /api/admin/movimientos?estado=RESUELTOS   -> últimos 100 resueltos
 *  POST /api/admin/movimientos/{id}/aprobar
 *  POST /api/admin/movimientos/{id}/rechazar      -> {motivo}
 *  GET  /api/admin/ganancias?desde=2026-11-01&hasta=2026-11-30  -> comisiones (fechas opcionales)
 *  GET  /api/admin/usuarios?q=jua                  -> buscar jugadores (sin q: los últimos registrados)
 *  GET  /api/admin/usuarios/{id}                   -> ficha: saldo, estadísticas, movimientos y partidas
 *  POST /api/admin/usuarios/{id}/bloquear          -> {motivo} suspende la cuenta
 *  POST /api/admin/usuarios/{id}/desbloquear       -> la reactiva
 *  GET  /api/admin/transferencias?estado=SIN_IDENTIFICAR|TODAS  -> transferencias que entraron a la cuenta
 *  POST /api/admin/transferencias                   -> {monto, cuit, nombre, operacion} cargar una a mano
 *  POST /api/admin/transferencias/{id}/asignar      -> {usuarioId} acreditarla a un jugador
 *  POST /api/admin/transferencias/{id}/devolver     -> {nota} marcar que se devolvió
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final MovimientoService movimientoService;
    private final GananciasService gananciasService;
    private final AdminUsuariosService usuariosService;
    private final TransferenciaService transferenciaService;

    public AdminController(MovimientoService movimientoService, GananciasService gananciasService,
                           AdminUsuariosService usuariosService, TransferenciaService transferenciaService) {
        this.movimientoService = movimientoService;
        this.gananciasService = gananciasService;
        this.usuariosService = usuariosService;
        this.transferenciaService = transferenciaService;
    }

    @GetMapping("/transferencias")
    public List<TransferenciaVista> transferencias(@RequestParam(defaultValue = "SIN_IDENTIFICAR") String estado) {
        return "SIN_IDENTIFICAR".equalsIgnoreCase(estado) ? transferenciaService.sinIdentificar() : transferenciaService.recientes();
    }

    /** Lo que manda el admin para cargar a mano una transferencia que vio en el banco. */
    public record NuevaTransferencia(java.math.BigDecimal monto, String cuit, String nombre, String operacion) {
    }

    /**
     * Mientras no esté conectado el aviso automático del banco, el admin carga lo que ve en el extracto
     * (monto y CUIT/CUIL de quien mandó) y el sistema busca al jugador por DNI y le acredita solo.
     * Con el número de operación del banco, la misma transferencia no se puede cargar dos veces.
     */
    @PostMapping("/transferencias")
    public TransferenciaService.Resultado cargarTransferencia(@RequestBody NuevaTransferencia t) {
        String op = t.operacion() == null ? "" : t.operacion().trim().replaceAll("\\s+", "");
        String idExterno = "MANUAL-" + (op.isEmpty() ? java.util.UUID.randomUUID() : op);
        return transferenciaService.registrar("MANUAL", idExterno, t.monto(), t.cuit(), t.nombre());
    }

    @PostMapping("/transferencias/{id}/asignar")
    public TransferenciaVista asignarTransferencia(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String admin,
                                                   @PathVariable Long id, @RequestBody Map<String, Long> cuerpo) {
        Long usuarioId = cuerpo == null ? null : cuerpo.get("usuarioId");
        if (usuarioId == null) throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Elegí a qué jugador se la acreditás.");
        return transferenciaService.asignar(admin, id, usuarioId);
    }

    @PostMapping("/transferencias/{id}/devolver")
    public TransferenciaVista devolverTransferencia(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String admin,
                                                    @PathVariable Long id,
                                                    @RequestBody(required = false) Map<String, String> cuerpo) {
        return transferenciaService.marcarDevuelta(admin, id, cuerpo == null ? null : cuerpo.get("nota"));
    }

    @GetMapping("/usuarios")
    public List<AdminUsuario.Resumen> usuarios(@RequestParam(required = false) String q) {
        return usuariosService.buscar(q);
    }

    @GetMapping("/usuarios/{id}")
    public AdminUsuario.Detalle usuario(@PathVariable Long id) {
        return usuariosService.detalle(id);
    }

    @PostMapping("/usuarios/{id}/bloquear")
    public AdminUsuario.Resumen bloquear(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String admin,
                                         @PathVariable Long id,
                                         @RequestBody(required = false) Map<String, String> cuerpo) {
        return usuariosService.bloquear(admin, id, cuerpo == null ? null : cuerpo.get("motivo"));
    }

    @PostMapping("/usuarios/{id}/desbloquear")
    public AdminUsuario.Resumen desbloquear(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String admin,
                                            @PathVariable Long id) {
        return usuariosService.desbloquear(admin, id);
    }

    @GetMapping("/ganancias")
    public Ganancias ganancias(@RequestParam(required = false) String desde,
                               @RequestParam(required = false) String hasta) {
        return gananciasService.calcular(fecha(desde), fecha(hasta));
    }

    private static LocalDate fecha(String texto) {
        if (texto == null || texto.isBlank()) return null;
        try {
            return LocalDate.parse(texto.trim());
        } catch (DateTimeParseException e) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Fecha inválida: " + texto);
        }
    }

    @GetMapping("/movimientos")
    public List<MovimientoVista> movimientos(@RequestParam(defaultValue = "PENDIENTE") String estado) {
        return "PENDIENTE".equalsIgnoreCase(estado) ? movimientoService.pendientes() : movimientoService.resueltos();
    }

    @PostMapping("/movimientos/{id}/aprobar")
    public MovimientoVista aprobar(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String admin,
                                   @PathVariable Long id) {
        return movimientoService.aprobar(admin, id);
    }

    @PostMapping("/movimientos/{id}/rechazar")
    public MovimientoVista rechazar(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String admin,
                                    @PathVariable Long id,
                                    @RequestBody(required = false) Map<String, String> cuerpo) {
        return movimientoService.rechazar(admin, id, cuerpo == null ? null : cuerpo.get("motivo"));
    }
}
