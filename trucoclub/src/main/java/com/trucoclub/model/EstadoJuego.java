package com.trucoclub.model;

public enum EstadoJuego {
    // Fases de preparación
    ESPERANDO_JUGADORES,        // La mesa está creada pero falta que entre el rival

    // Fases de juego activo
    ESPERANDO_CARTA,            // Flujo normal: es el turno de alguien para tirar una carta
    ESPERANDO_RESPUESTA_ENVIDO, // Alguien cantó Envido/Real/Falta y el otro debe decidir (Quiero/No Quiero/Revirar)
    ESPERANDO_RESPUESTA_TRUCO,  // Alguien cantó Truco/Retruco/Vale4 y el otro debe decidir

    // Fases de transición y cierre
    ENTRE_MANOS,                // Terminó la ronda actual. Pausa para mostrar el ganador antes de repartir de nuevo
    TERMINADO                   // Alguien llegó a los 15 o 30 puntos. Fin del partido.
}
