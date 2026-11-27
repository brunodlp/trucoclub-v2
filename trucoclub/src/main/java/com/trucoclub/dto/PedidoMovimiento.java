package com.trucoclub.dto;

import java.math.BigDecimal;

/**
 * Lo que manda el front para pedir un depósito o un retiro.
 * detalle = número de operación (depósito) o alias / CBU / CVU (retiro).
 */
public record PedidoMovimiento(BigDecimal monto, String detalle) {
}
