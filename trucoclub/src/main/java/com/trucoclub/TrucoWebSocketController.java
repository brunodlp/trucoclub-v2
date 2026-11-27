package com.trucoclub;

import com.trucoclub.model.MensajeAccion;
import com.trucoclub.model.MensajeJugada;
import com.trucoclub.service.TrucoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * Recibe las acciones de los jugadores por WebSocket.
 * El jugador es SIEMPRE el usuario autenticado de la conexión (principal), así nadie puede
 * jugar haciéndose pasar por otro. El nombre que venga en el mensaje se ignora.
 */
@Controller
public class TrucoWebSocketController {

    @Autowired
    private TrucoService trucoService;

    @MessageMapping("/jugar") // Escucha los mensajes que vienen desde /app/jugar
    public void recibirJugada(MensajeJugada mensaje, Principal principal) {
        if (principal == null) return;
        trucoService.jugarCarta(mensaje.getMesaId(), principal.getName(), mensaje.getCartaIndice());
    }

    // Ya no hace falta (el servidor reparte solo), lo dejamos para no romper clientes viejos
    @MessageMapping("/partida/{mesaId}/siguiente")
    public void avanzarMano(@DestinationVariable String mesaId) {
        trucoService.avanzarSiguienteMano(mesaId);
    }

    @MessageMapping("/cantar")
    public void recibirCanto(MensajeAccion mensaje, Principal principal) {
        if (principal == null) return;
        mensaje.setNombreJugador(principal.getName());
        trucoService.procesarCanto(mensaje);
    }

    @MessageMapping("/responder")
    public void recibirRespuesta(MensajeAccion mensaje, Principal principal) {
        if (principal == null) return;
        mensaje.setNombreJugador(principal.getName());
        trucoService.procesarRespuesta(mensaje);
    }
}
