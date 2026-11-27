package com.trucoclub.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Lo que ve el admin de cada jugador. */
public final class AdminUsuario {

    private AdminUsuario() {}

    /** Una fila de la búsqueda. */
    public record Resumen(Long id, String username, BigDecimal saldo, String rol, boolean bloqueado) {
    }

    /** Ficha completa del jugador. */
    public record Detalle(Long id, String username, String email, LocalDateTime registrado, BigDecimal saldo,
                          String rol, boolean bloqueado, String motivoBloqueo, Estadisticas estadisticas,
                          List<MovimientoVista> movimientos, List<Partida> partidas) {
    }

    public record Estadisticas(long jugadas, long ganadas, BigDecimal depositado, BigDecimal retirado,
                               BigDecimal apostado, BigDecimal cobrado) {
    }

    /** Una mesa del jugador. resultado: GANO, PERDIO, JUGANDO, ESPERANDO, CANCELADA o ANULADA. */
    public record Partida(Long id, LocalDateTime fecha, String rival, BigDecimal monto, int puntos,
                          String resultado, BigDecimal premio) {
    }
}
