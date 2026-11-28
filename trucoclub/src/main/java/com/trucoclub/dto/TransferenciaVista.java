package com.trucoclub.dto;

import com.trucoclub.entity.TransferenciaEntrante;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Una transferencia entrante como la ve el admin. */
public record TransferenciaVista(Long id, String proveedor, String idExterno, BigDecimal monto, String cuitOriginante,
                                 String nombreOriginante, String dniDetectado, String estado, String usuario,
                                 String nota, LocalDateTime recibida, LocalDateTime resuelta, String resueltoPor) {

    public static TransferenciaVista de(TransferenciaEntrante t) {
        return new TransferenciaVista(t.getId(), t.getProveedor(), t.getIdExterno(), t.getMonto(), t.getCuitOriginante(),
                t.getNombreOriginante(), t.getDniDetectado(), t.getEstado().name(),
                t.getUsuario() == null ? null : t.getUsuario().getUsername(), t.getNota(), t.getRecibida(),
                t.getResuelta(), t.getResueltoPor());
    }
}
