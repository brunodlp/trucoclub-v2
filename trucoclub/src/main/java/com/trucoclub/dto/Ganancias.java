package com.trucoclub.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Todo lo que muestra la pestaña Ganancias del admin. */
public record Ganancias(
        Periodo hoy,
        Periodo semana,
        Periodo mes,
        Periodo total,
        Rango rango,
        Caja caja) {

    /** Comisión y cantidad de partidos en un período. */
    public record Periodo(BigDecimal comision, long partidos) {
    }

    /** El rango de fechas elegido: total, comisión por día y los partidos. */
    public record Rango(LocalDate desde, LocalDate hasta, BigDecimal comision, long partidos, BigDecimal volumen,
                        List<Dia> porDia, List<Partido> partidosLista) {
    }

    public record Dia(LocalDate fecha, BigDecimal comision, long partidos) {
    }

    public record Partido(Long id, LocalDateTime fecha, String creador, String rival, String ganador,
                          BigDecimal monto, BigDecimal premio, BigDecimal comision) {
    }

    /**
     * Control de caja. Lo que entró a tu cuenta (depósitos − retiros pagados) tiene que ser igual a
     * lo que les debés a los jugadores (saldos + apuestas en mesas abiertas + retiros sin pagar)
     * más tu comisión. Si la diferencia no da 0, hay algo para revisar.
     */
    public record Caja(BigDecimal depositos, BigDecimal retiros, BigDecimal enCuenta,
                       BigDecimal saldosJugadores, BigDecimal enMesas, BigDecimal retirosPendientes,
                       BigDecimal deJugadores, BigDecimal comisionTotal, BigDecimal diferencia) {
    }
}
