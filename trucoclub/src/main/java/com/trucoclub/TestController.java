package com.trucoclub;

import com.trucoclub.model.Partida;
import com.trucoclub.service.TrucoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/truco") // Asegurate de que esta ruta coincida con Postman
public class TestController {

    @Autowired
    private TrucoService trucoService;

    @GetMapping("/status")
    public String status() {
        return "Servidor funcionando. Listo para recibir jugadas de Truco.";
    }

    @PostMapping("/nueva")
    public String nuevaPartida(@RequestParam String j1, @RequestParam String j2, @RequestParam int puntos) {
        // Aquí llamamos a tu lógica real que ya pasamos al Service
        return trucoService.crearNuevaPartida(j1, j2, puntos);
    }

    @GetMapping("/estado/{id}")
    public Partida verEstado(@PathVariable String id) {
        // Buscamos la partida en el service usando el ID (mesa-1)
        return trucoService.obtenerPartida(id);
    }

    @PostMapping("/jugar")
    public Partida tirarCarta(
            @RequestParam String mesaId,
            @RequestParam String jugador, // <--- Ahora lo usamos dinámicamente
            @RequestParam int cartaIndice
    ) {
        return trucoService.jugarCarta(mesaId, jugador, cartaIndice);
    }
}