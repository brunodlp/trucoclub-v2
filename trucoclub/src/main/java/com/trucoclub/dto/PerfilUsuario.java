package com.trucoclub.dto;

import java.math.BigDecimal;

/** Lo que muestra la pantalla de inicio: nombre, foto, saldo y rol. Nunca viaja la contraseña. */
public record PerfilUsuario(String username, String fotoUrl, BigDecimal saldo, Integer partidasGanadas, String rol) {
}
