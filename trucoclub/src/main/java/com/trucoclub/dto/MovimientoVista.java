package com.trucoclub.dto;

import com.trucoclub.entity.Movimiento;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Un movimiento como lo ve el front. resueltoPor y dni solo se completan en la vista del admin. */
public record MovimientoVista(
        Long id,
        String usuario,
        String dni,
        String tipo,
        String estado,
        BigDecimal monto,
        String detalle,
        BigDecimal saldoDespues,
        String motivoRechazo,
        LocalDateTime creado,
        LocalDateTime resuelto,
        String resueltoPor) {

    public static MovimientoVista paraUsuario(Movimiento m) {
        return de(m, null, null);
    }

    /** El admin ve el DNI del jugador para compararlo con el titular de la transferencia. */
    public static MovimientoVista paraAdmin(Movimiento m) {
        return de(m, m.getResueltoPor(), m.getUsuario().getDni());
    }

    private static MovimientoVista de(Movimiento m, String resueltoPor, String dni) {
        return new MovimientoVista(m.getId(), m.getUsuario().getUsername(), dni, m.getTipo().name(), m.getEstado().name(),
                m.getMonto(), m.getDetalle(), m.getSaldoDespues(), m.getMotivoRechazo(), m.getCreado(),
                m.getResuelto(), resueltoPor);
    }
}
