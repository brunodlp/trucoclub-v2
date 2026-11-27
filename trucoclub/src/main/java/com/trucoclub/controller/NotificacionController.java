package com.trucoclub.controller;

import com.trucoclub.dto.NotificacionVista;
import com.trucoclub.seguridad.AuthInterceptor;
import com.trucoclub.service.NotificacionService;
import org.springframework.web.bind.annotation.*;

/**
 *  GET  /api/notificaciones        -> mis últimas 30 y cuántas sin leer
 *  POST /api/notificaciones/leer   -> marcar todas como leídas
 */
@RestController
@RequestMapping("/api/notificaciones")
public class NotificacionController {

    private final NotificacionService notificacionService;

    public NotificacionController(NotificacionService notificacionService) {
        this.notificacionService = notificacionService;
    }

    @GetMapping
    public NotificacionVista.Lista mias(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario) {
        return notificacionService.de(usuario);
    }

    @PostMapping("/leer")
    public void leer(@RequestAttribute(AuthInterceptor.ATRIBUTO_USUARIO) String usuario) {
        notificacionService.marcarLeidas(usuario);
    }
}
