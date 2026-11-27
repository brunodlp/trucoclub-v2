package com.trucoclub.dto;

import java.math.BigDecimal;

/** Lo que muestra la pantalla de inicio: nombre, foto, saldo, rol y DNI (el propio; null si falta cargarlo). */
public record PerfilUsuario(String username, String fotoUrl, BigDecimal saldo, Integer partidasGanadas, String rol,
                            String dni) {
}
