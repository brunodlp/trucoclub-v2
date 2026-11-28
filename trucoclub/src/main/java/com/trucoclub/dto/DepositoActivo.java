package com.trucoclub.dto;

/** El depósito en curso del jugador (o movimiento null si no tiene) y cuántos segundos le quedan. */
public record DepositoActivo(MovimientoVista movimiento, long segundosRestantes) {

    public static DepositoActivo ninguno() {
        return new DepositoActivo(null, 0);
    }
}
