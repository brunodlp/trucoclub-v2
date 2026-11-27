package com.trucoclub.repository;

import com.trucoclub.entity.EstadoMesa;
import com.trucoclub.entity.MesaApuesta;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface MesaApuestaRepository extends JpaRepository<MesaApuesta, Long> {

    /** Trae la mesa bloqueándola hasta que termine la transacción (para que dos no entren a la vez). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from MesaApuesta m where m.id = :id")
    Optional<MesaApuesta> buscarParaActualizar(@Param("id") Long id);

    List<MesaApuesta> findByEstadoIn(Collection<EstadoMesa> estados);

    /** Comisión cobrada en partidos terminados entre dos momentos (desde inclusive, hasta exclusive). */
    @Query("select coalesce(sum(m.comision), 0) from MesaApuesta m where m.estado = :estado "
            + "and m.terminada >= :desde and m.terminada < :hasta")
    BigDecimal sumarComision(@Param("estado") EstadoMesa estado, @Param("desde") LocalDateTime desde,
                             @Param("hasta") LocalDateTime hasta);

    @Query("select count(m) from MesaApuesta m where m.estado = :estado and m.terminada >= :desde and m.terminada < :hasta")
    long contarTerminadas(@Param("estado") EstadoMesa estado, @Param("desde") LocalDateTime desde,
                          @Param("hasta") LocalDateTime hasta);

    /** Partidos terminados en un rango, el más nuevo primero. */
    @Query("select m from MesaApuesta m where m.estado = :estado and m.terminada >= :desde and m.terminada < :hasta "
            + "order by m.terminada desc")
    List<MesaApuesta> terminadasEntre(@Param("estado") EstadoMesa estado, @Param("desde") LocalDateTime desde,
                                      @Param("hasta") LocalDateTime hasta);

    /** Todas las mesas donde jugó (o abrió) un usuario, la más nueva primero. */
    @Query("select m from MesaApuesta m where m.creador.id = :id or m.rival.id = :id order by m.id desc")
    List<MesaApuesta> deUsuario(@Param("id") Long usuarioId);

    /** Suma de lo apostado por cada jugador en mesas con cierto estado. */
    @Query("select coalesce(sum(m.monto), 0) from MesaApuesta m where m.estado = :estado")
    BigDecimal sumarMontos(@Param("estado") EstadoMesa estado);

    /** Cuántas mesas abiertas o en juego tiene el usuario (como creador o como rival). */
    @Query("select count(m) from MesaApuesta m where m.estado in :estados "
            + "and (m.creador.username = :username or m.rival.username = :username)")
    long contarDeUsuario(@Param("username") String username, @Param("estados") Collection<EstadoMesa> estados);
}
