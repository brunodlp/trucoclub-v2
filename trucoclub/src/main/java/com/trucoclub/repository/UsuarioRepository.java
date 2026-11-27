package com.trucoclub.repository;

import com.trucoclub.entity.Usuario;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByUsername(String username);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);

    /** El perfil de TrucoClub del usuario de Supabase Auth. */
    Optional<Usuario> findByAuthId(java.util.UUID authId);

    /** En PostgreSQL las comparaciones distinguen mayúsculas: esto no (Joaco = joaco). */
    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByDni(String dni);

    /** Búsqueda del admin por nombre (parte del nombre, sin importar mayúsculas). */
    java.util.List<Usuario> findTop20ByUsernameContainingIgnoreCaseOrderByUsernameAsc(String parte);

    /** Los últimos registrados (cuando el admin no escribió nada). */
    java.util.List<Usuario> findTop20ByOrderByIdDesc();

    /** Plata que tienen todos los jugadores en su saldo. */
    @Query("select coalesce(sum(u.saldo), 0) from Usuario u")
    java.math.BigDecimal sumarSaldos();

    /**
     * Trae el usuario bloqueando su fila hasta que termine la transacción. Se usa cada vez que se
     * toca el saldo, para que dos operaciones al mismo tiempo no se pisen (ej: dos retiros a la vez).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from Usuario u where u.username = :username")
    Optional<Usuario> buscarParaActualizarSaldo(@Param("username") String username);
}
