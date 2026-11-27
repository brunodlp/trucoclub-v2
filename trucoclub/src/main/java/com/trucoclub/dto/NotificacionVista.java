package com.trucoclub.dto;

import com.trucoclub.entity.Notificacion;

import java.time.LocalDateTime;
import java.util.List;

public record NotificacionVista(Long id, String tipo, String texto, boolean leida, LocalDateTime creada) {

    public static NotificacionVista de(Notificacion n) {
        return new NotificacionVista(n.getId(), n.getTipo().name(), n.getTexto(), n.isLeida(), n.getCreada());
    }

    /** La lista más cuántas hay sin leer (para el numerito de la campana). */
    public record Lista(List<NotificacionVista> notificaciones, long sinLeer) {
    }
}
