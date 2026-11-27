package com.trucoclub.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "usuarios")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(unique = true, nullable = false)
    private String email;

    /** El usuario de Supabase Auth (auth.users.id) al que pertenece este perfil. */
    @Column(name = "auth_id", unique = true)
    private java.util.UUID authId;

    private LocalDateTime fechaRegistro = LocalDateTime.now();

    private Integer partidasGanadas = 0;

    // NUEVO: plata disponible para apostar. Arranca en 0.
    @Column(precision = 14, scale = 2)
    private BigDecimal saldo = BigDecimal.ZERO;

    // NUEVO: foto de perfil (por ahora vacía; después se podrá subir)
    private String fotoUrl;

    /** DNI (solo números). Sirve para verificar que depósitos y retiros sean del titular. Uno por cuenta. */
    @Column(length = 8, unique = true)
    private String dni;

    // NUEVO: rol del usuario. Los que ya existían quedan como JUGADOR.
    @Enumerated(EnumType.STRING)
    @Column(length = 20, columnDefinition = "varchar(20)")
    private Rol rol = Rol.JUGADOR;

    // NUEVO: un admin puede suspender la cuenta (no puede entrar ni jugar). Su saldo queda guardado.
    private Boolean bloqueado = false;

    @Column(length = 200)
    private String motivoBloqueo;

    // Constructor vacío obligatorio para JPA
    public Usuario() {}

    // Getters y Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public java.util.UUID getAuthId() { return authId; }
    public void setAuthId(java.util.UUID authId) { this.authId = authId; }

    public LocalDateTime getFechaRegistro() { return fechaRegistro; }
    public void setFechaRegistro(LocalDateTime fechaRegistro) { this.fechaRegistro = fechaRegistro; }

    public Integer getPartidasGanadas() { return partidasGanadas; }
    public void setPartidasGanadas(Integer partidasGanadas) { this.partidasGanadas = partidasGanadas; }

    public BigDecimal getSaldo() { return saldo; }
    public void setSaldo(BigDecimal saldo) { this.saldo = saldo; }

    public String getDni() { return dni; }
    public void setDni(String dni) { this.dni = dni; }
    public String getFotoUrl() { return fotoUrl; }
    public void setFotoUrl(String fotoUrl) { this.fotoUrl = fotoUrl; }

    public Rol getRol() { return rol == null ? Rol.JUGADOR : rol; }
    public void setRol(Rol rol) { this.rol = rol; }

    public boolean esAdmin() { return getRol() == Rol.ADMIN; }

    public boolean estaBloqueado() { return Boolean.TRUE.equals(bloqueado); }
    public void setBloqueado(boolean bloqueado) { this.bloqueado = bloqueado; }
    public String getMotivoBloqueo() { return motivoBloqueo; }
    public void setMotivoBloqueo(String motivoBloqueo) { this.motivoBloqueo = motivoBloqueo; }
}
