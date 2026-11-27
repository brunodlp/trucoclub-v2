package com.trucoclub.dto;

import java.math.BigDecimal;

/** A dónde transferir para depositar, los montos mínimos y máximo, y cuántos retiros se pueden pedir por día. */
public record DatosPagos(String alias, String cbu, String titular,
                         BigDecimal minimoDeposito, BigDecimal minimoRetiro, BigDecimal maximo,
                         int retirosPorDia) {
}
