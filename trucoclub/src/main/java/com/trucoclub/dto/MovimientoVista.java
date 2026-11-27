package com.trucoclub.dto;

import com.trucoclub.entity.Movimiento;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Un movimiento como lo ve el front. resueltoPor solo se completa en la vista del admin. */
public record MovimientoVista(
        Long id,
        String usuario,
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
        return de(m, null);
    }

    public static MovimientoVista paraAdmin(Movimiento m) {
        return de(m, m.getResueltoPor());
    }

    private static MovimientoVista de(Movimiento m, String resueltoPor) {
        return new MovimientoVista(m.getId(), m.getUsuario().getUsername(), m.getTipo().name(), m.getEstado().name(),
                m.getMonto(), m.getDetalle(), m.getSaldoDespues(), m.getMotivoRechazo(), m.getCreado(),
                m.getResuelto(), resueltoPor);
    }
}
