package com.trucoclub.entity;

public enum EstadoMesa {
    ESPERANDO,   // creada, esperando rival (la apuesta del creador ya está descontada)
    JUGANDO,     // los dos pusieron su apuesta y están jugando
    TERMINADA,   // se pagó el premio al ganador
    CANCELADA,   // el creador la cerró antes de que entre alguien (se le devolvió la apuesta)
    ANULADA      // el servidor se reinició con la mesa abierta: se devolvieron las apuestas
}
