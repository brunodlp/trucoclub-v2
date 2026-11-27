package com.trucoclub.entity;

/** Tipos de movimiento de saldo. */
public enum TipoMovimiento {
    DEPOSITO,    // el jugador cargó plata (lo aprueba un admin)
    RETIRO,      // el jugador sacó plata (lo aprueba un admin)
    APUESTA,     // se descontó la apuesta al crear o entrar a una mesa
    PREMIO,      // ganó una mesa
    DEVOLUCION   // se le devolvió la apuesta (mesa cancelada o anulada)
}
