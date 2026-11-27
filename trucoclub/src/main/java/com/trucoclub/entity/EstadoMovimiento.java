package com.trucoclub.entity;

public enum EstadoMovimiento {
    PENDIENTE,   // esperando que un admin lo revise
    APROBADO,    // el admin lo confirmó
    RECHAZADO,   // el admin lo rechazó (si era un retiro, la plata vuelve al saldo)
    CANCELADO    // el mismo usuario lo canceló antes de que lo revisen
}
