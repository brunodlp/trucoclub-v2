package com.trucoclub;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Solo queda el chequeo de que el servidor está vivo.
 * (Los endpoints de prueba viejos /nueva, /estado y /jugar se sacaron: dejaban jugar
 *  haciéndose pasar por otro y mostraban las cartas de los dos jugadores.)
 */
@RestController
@RequestMapping("/api/truco")
public class TestController {

    @GetMapping("/status")
    public String status() {
        return "Servidor funcionando. Listo para recibir jugadas de Truco.";
    }
}
