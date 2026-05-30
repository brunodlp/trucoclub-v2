package com.trucoclub;

import com.trucoclub.model.MensajeAccion;
import com.trucoclub.model.MensajeJugada;
import com.trucoclub.model.Partida;
import com.trucoclub.service.TrucoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable; // 👈 NUEVA IMPORTACIÓN
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class TrucoWebSocketController {

    @Autowired
    private TrucoService trucoService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/jugar") // Escucha los mensajes que vienen desde /app/jugar
    public void recibirJugada(MensajeJugada mensaje) {
        // 1. Ejecutamos la lógica de la jugada
        Partida partidaActualizada = trucoService.jugarCarta(
                mensaje.getMesaId(),
                mensaje.getJugador(),
                mensaje.getCartaIndice()
        );

        // 2. Enviamos el resultado a todos los jugadores de esa mesa a través del túnel
        String destination = "/topic/partida/" + mensaje.getMesaId();
        messagingTemplate.convertAndSend(destination, partidaActualizada);
    }

    // 👇 ACÁ AGREGAMOS EL ENDPOINT PARA LA PAUSA AUTOMÁTICA 👇
    @MessageMapping("/partida/{mesaId}/siguiente") // Escucha /app/partida/{mesaId}/siguiente
    public void avanzarMano(@DestinationVariable String mesaId) {

        // 1. Le avisamos al servicio que busque la partida y ejecute la nueva ronda
        Partida partidaActualizada = trucoService.avanzarSiguienteMano(mesaId);

        // 2. Despachamos el estado actualizado (con cartas nuevas y mesa limpia) a ambos jugadores
        String destination = "/topic/partida/" + mesaId;
        messagingTemplate.convertAndSend(destination, partidaActualizada);
    }

    // --- NUEVAS OREJAS PARA LOS GRITOS Y RESPUESTAS ---

    @MessageMapping("/cantar")
    public void recibirCanto(MensajeAccion mensaje) {
        System.out.println("LLEGÓ UN CANTO AL CONTROLLER 📡: " + mensaje.getAccion() + " de " + mensaje.getNombreJugador());

        // 1. Procesamos el canto
        Partida partidaActualizada = trucoService.procesarCanto(mensaje);

        // 2. Si todo salió bien, actualizamos la mesa
        if(partidaActualizada != null) {
            String destination = "/topic/partida/" + mensaje.getMesaId();
            messagingTemplate.convertAndSend(destination, partidaActualizada);
        }
    }

    @MessageMapping("/responder")
    public void recibirRespuesta(MensajeAccion mensaje) {
        System.out.println("LLEGÓ UNA RESPUESTA AL CONTROLLER 📡: " + mensaje.getAccion() + " de " + mensaje.getNombreJugador());

        // 1. Procesamos la respuesta (Quiero, No Quiero, etc)
        Partida partidaActualizada = trucoService.procesarRespuesta(mensaje);

        // 2. Actualizamos la mesa
        if(partidaActualizada != null) {
            String destination = "/topic/partida/" + mensaje.getMesaId();
            messagingTemplate.convertAndSend(destination, partidaActualizada);
        }
    }
}