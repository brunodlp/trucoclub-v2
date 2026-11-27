package com.trucoclub.controller;

import com.trucoclub.dto.VistaPartida;
import com.trucoclub.seguridad.AuthInterceptor;
import com.trucoclub.service.TrucoService;
import com.trucoclub.service.TrucoService.MesaInfo;
import com.trucoclub.service.TrucoService.Sala;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Sala de mesas con plata. Todos estos pedidos necesitan token: el jugador sale del token.
 *
 *  GET  /api/truco/mesas                    -> la sala: mesas esperando rival, mi mesa, mi partida y mi saldo
 *  GET  /api/truco/mesas/opciones           -> montos que se pueden elegir y comisión
 *  POST /api/truco/mesas  {monto, puntos}   -> crea la mesa (descuenta la apuesta) y quedás esperando en la sala
 *  POST /api/truco/mesas/{id}/unirse        -> entrás (descuenta la apuesta) y arranca la partida
 *  POST /api/truco/mesas/{id}/cancelar      -> cerrás tu mesa antes de que entre alguien (te devuelve la apuesta)
 *  GET  /api/truco/mesas/{id}               -> estado de la partida visto por vos
 *  POST /api/truco/mesas/{id}/abandonar     -> abandonás (el partido termina y gana el otro)
 *
 * Las actualizaciones de la partida llegan por WebSocket al canal personal /user/queue/partida.
 */
@RestController
@RequestMapping("/api/truco/mesas")
public class MesaController {

    /** Lo que manda el front para crear una mesa. */
    public record NuevaMesa(BigDecimal monto, Integer puntos) {
    }

    private final TrucoService trucoService;

    public MesaController(TrucoService trucoService) {
        this.trucoService = trucoService;
    }

    @GetMapping
    public Sala sala(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario) {
        return trucoService.sala(usuario);
    }

    @GetMapping("/opciones")
    public Map<String, Object> opciones() {
        return trucoService.opciones();
    }

    @PostMapping
    public MesaInfo crear(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario,
                          @RequestBody NuevaMesa pedido) {
        if (pedido == null || pedido.monto() == null || pedido.puntos() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Elegí el monto y a cuántos puntos.");
        }
        return trucoService.crearMesa(usuario, pedido.monto(), pedido.puntos());
    }

    @PostMapping("/{id}/unirse")
    public MesaInfo unirse(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario, @PathVariable String id) {
        return trucoService.unirse(id, usuario);
    }

    @PostMapping("/{id}/cancelar")
    public void cancelar(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario, @PathVariable String id) {
        trucoService.cancelarMesa(id, usuario);
    }

    @GetMapping("/{id}")
    public VistaPartida vista(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario, @PathVariable String id) {
        return trucoService.vista(id, usuario);
    }

    @PostMapping("/{id}/abandonar")
    public void abandonar(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario, @PathVariable String id) {
        trucoService.abandonar(id, usuario);
    }
}
