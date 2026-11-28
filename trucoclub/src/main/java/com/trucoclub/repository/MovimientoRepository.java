package com.trucoclub.repository;

import com.trucoclub.entity.EstadoMovimiento;
import com.trucoclub.entity.Movimiento;
import com.trucoclub.entity.TipoMovimiento;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface MovimientoRepository extends JpaRepository<Movimiento, Long> {

    /** Los últimos 100 movimientos de un usuario, el más nuevo primero. */
    List<Movimiento> findTop100ByUsuarioUsernameOrderByIdDesc(String username);

    /** Pendientes, el más viejo primero (para que el admin los atienda en orden). */
    List<Movimiento> findByEstadoOrderByIdAsc(EstadoMovimiento estado);

    /** El pedido abierto de un tipo para un jugador (depósito en curso). */
    Optional<Movimiento> findFirstByUsuarioUsernameAndTipoAndEstadoOrderByIdDesc(String username, TipoMovimiento tipo,
                                                                               EstadoMovimiento estado);

    /** Pedidos de un tipo que siguen abiertos desde antes de cierta hora (para vencerlos). */
    List<Movimiento> findByTipoAndEstadoAndCreadoBefore(TipoMovimiento tipo, EstadoMovimiento estado,
                                                        java.time.LocalDateTime antes);

    /** Los últimos 100 ya resueltos de ciertos tipos (para el admin: depósitos y retiros). */
    List<Movimiento> findTop100ByEstadoNotAndTipoInOrderByIdDesc(EstadoMovimiento estado, Collection<TipoMovimiento> tipos);

    List<Movimiento> findTop100ByUsuarioIdOrderByIdDesc(Long usuarioId);

    @Query("select coalesce(sum(m.monto), 0) from Movimiento m where m.usuario.id = :id and m.tipo = :tipo and m.estado = :estado")
    BigDecimal sumarDeUsuario(@Param("id") Long usuarioId, @Param("tipo") TipoMovimiento tipo,
                              @Param("estado") EstadoMovimiento estado);

    /** Suma de montos de un tipo y estado (ej: todos los depósitos aprobados). */
    @Query("select coalesce(sum(m.monto), 0) from Movimiento m where m.tipo = :tipo and m.estado = :estado")
    BigDecimal sumar(@Param("tipo") TipoMovimiento tipo, @Param("estado") EstadoMovimiento estado);

    /** Cuántos movimientos de un tipo pidió el usuario desde cierto momento (ej: retiros de hoy). */
    long countByUsuarioUsernameAndTipoAndEstadoInAndCreadoGreaterThanEqual(String username, TipoMovimiento tipo,
            Collection<EstadoMovimiento> estados, java.time.LocalDateTime desde);

    long countByUsuarioUsernameAndTipoAndEstado(String username, TipoMovimiento tipo, EstadoMovimiento estado);

    /**
     * Trae el movimiento bloqueándolo hasta que termine la transacción. Así, si dos admins
     * aprueban el mismo pedido a la vez, el segundo espera y después ve que ya no está pendiente.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Movimiento m where m.id = :id")
    Optional<Movimiento> buscarParaResolver(@Param("id") Long id);
}
