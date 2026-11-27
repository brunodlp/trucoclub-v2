package com.trucoclub.service;

import com.trucoclub.dto.NotificacionVista;
import com.trucoclub.entity.Notificacion;
import com.trucoclub.entity.Usuario;
import com.trucoclub.repository.NotificacionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Avisos para los jugadores. Se crean dentro de la misma transacción que el cambio que avisan
 * (si la aprobación falla y se deshace, el aviso tampoco queda).
 */
@Service
public class NotificacionService {

    private final NotificacionRepository repository;

    public NotificacionService(NotificacionRepository repository) {
        this.repository = repository;
    }

    public void avisar(Usuario usuario, Notificacion.Tipo tipo, String texto) {
        repository.save(new Notificacion(usuario, tipo, texto));
    }

    @Transactional(readOnly = true)
    public NotificacionVista.Lista de(String username) {
        return new NotificacionVista.Lista(
                repository.findTop30ByUsuarioUsernameOrderByIdDesc(username).stream().map(NotificacionVista::de).toList(),
                repository.countByUsuarioUsernameAndLeidaFalse(username));
    }

    @Transactional
    public void marcarLeidas(String username) {
        repository.marcarLeidas(username);
    }
}
