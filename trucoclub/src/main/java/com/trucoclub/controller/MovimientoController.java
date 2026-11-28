package com.trucoclub.controller;

import com.trucoclub.dto.DatosPagos;
import com.trucoclub.dto.DepositoActivo;
import com.trucoclub.dto.MovimientoVista;
import com.trucoclub.dto.PedidoMovimiento;
import com.trucoclub.seguridad.AuthInterceptor;
import com.trucoclub.service.MovimientoService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Movimientos del jugador logueado (el usuario siempre sale del token).
 *
 *  GET  /api/movimientos                 -> mis movimientos
 *  GET  /api/movimientos/datos           -> a dónde transferir, mínimos y máximo
 *  POST /api/movimientos/deposito        -> {monto} arranca un depósito (10 min para transferir; lo aprueba un admin)
 *  GET  /api/movimientos/deposito/activo -> el depósito en curso y los segundos que le quedan
 *  POST /api/movimientos/retiro          -> {monto, detalle: alias o CBU/CVU}
 *  POST /api/movimientos/{id}/cancelar   -> cancelar un pedido mío pendiente
 */
@RestController
@RequestMapping("/api/movimientos")
public class MovimientoController {

    private final MovimientoService movimientoService;

    public MovimientoController(MovimientoService movimientoService) {
        this.movimientoService = movimientoService;
    }

    @GetMapping
    public List<MovimientoVista> mios(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario) {
        return movimientoService.deUsuario(usuario);
    }

    @GetMapping("/datos")
    public DatosPagos datos() {
        return movimientoService.datosPagos();
    }

    @PostMapping("/deposito")
    public DepositoActivo deposito(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario,
                                   @RequestBody PedidoMovimiento pedido) {
        return movimientoService.pedirDeposito(usuario, pedido.monto());
    }

    @GetMapping("/deposito/activo")
    public DepositoActivo depositoActivo(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario) {
        return movimientoService.depositoActivo(usuario);
    }

    @PostMapping("/retiro")
    public MovimientoVista retirar(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario,
                                   @RequestBody PedidoMovimiento pedido) {
        return movimientoService.pedirRetiro(usuario, pedido.monto(), pedido.detalle());
    }

    @PostMapping("/{id}/cancelar")
    public MovimientoVista cancelar(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario,
                                    @PathVariable Long id) {
        return movimientoService.cancelar(usuario, id);
    }
}
