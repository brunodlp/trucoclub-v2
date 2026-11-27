package com.trucoclub.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Montos que se pueden apostar en una mesa y cálculo del premio.
 *
 *   $500 a $3.000         de $250 en $250
 *   $3.500 a $100.000     de $500 en $500
 *   $102.000 a $200.000   de $2.000 en $2.000
 *   $205.000 a $350.000   de $5.000 en $5.000
 *
 * Premio = lo que pusieron los dos (monto x 2) menos el 5% de comisión.
 * Ej: mesa de $5.000 → pozo $10.000 → premio $9.500.
 */
public final class MontosMesa {

    public static final int COMISION_PORCENTAJE = 5;
    private static final BigDecimal FACTOR_PREMIO = new BigDecimal("1.90"); // 2 x 0,95

    public static final List<Integer> OPCIONES;
    private static final Set<Integer> VALIDOS;

    static {
        List<Integer> lista = new ArrayList<>();
        agregar(lista, 500, 3_000, 250);
        agregar(lista, 3_500, 100_000, 500);
        agregar(lista, 102_000, 200_000, 2_000);
        agregar(lista, 205_000, 350_000, 5_000);
        OPCIONES = Collections.unmodifiableList(lista);
        VALIDOS = new HashSet<>(lista);
    }

    private MontosMesa() {}

    private static void agregar(List<Integer> lista, int desde, int hasta, int paso) {
        for (int v = desde; v <= hasta; v += paso) lista.add(v);
    }

    public static boolean valido(BigDecimal monto) {
        if (monto == null || monto.signum() <= 0) return false;
        try {
            return VALIDOS.contains(monto.intValueExact());
        } catch (ArithmeticException e) {
            return false; // tiene decimales
        }
    }

    public static BigDecimal premio(BigDecimal monto) {
        return monto.multiply(FACTOR_PREMIO).setScale(2, RoundingMode.DOWN);
    }
}
