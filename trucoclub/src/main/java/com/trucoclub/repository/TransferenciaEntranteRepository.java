package com.trucoclub.repository;

import com.trucoclub.entity.TransferenciaEntrante;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TransferenciaEntranteRepository extends JpaRepository<TransferenciaEntrante, Long> {

    Optional<TransferenciaEntrante> findByIdExterno(String idExterno);

    /** Las que esperan que un admin las revise, la más vieja primero. */
    List<TransferenciaEntrante> findByEstadoOrderByIdAsc(TransferenciaEntrante.Estado estado);

    /** Las últimas 100 (cualquier estado). */
    List<TransferenciaEntrante> findTop100ByOrderByIdDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from TransferenciaEntrante t where t.id = :id")
    Optional<TransferenciaEntrante> buscarParaResolver(@Param("id") Long id);
}
