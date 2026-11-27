package com.trucoclub.repository;

import com.trucoclub.entity.Notificacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificacionRepository extends JpaRepository<Notificacion, Long> {

    List<Notificacion> findTop30ByUsuarioUsernameOrderByIdDesc(String username);

    long countByUsuarioUsernameAndLeidaFalse(String username);

    /** Marca todas las del usuario como leídas. */
    @Modifying
    @Query("update Notificacion n set n.leida = true where n.usuario.id = (select u.id from Usuario u where u.username = :username) and n.leida = false")
    int marcarLeidas(@Param("username") String username);
}
