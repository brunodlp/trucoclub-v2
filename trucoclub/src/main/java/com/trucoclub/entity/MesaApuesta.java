package com.trucoclub.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Registro de cada mesa con plata en juego. La partida en sí vive en memoria (TrucoService);
 * esto queda guardado para saber siempre dónde está la plata, aunque el servidor se reinicie.
 */
@Entity
@Table(name = "mesas")
public class MesaApuesta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "creador_id", nullable = false)
    private Usuario creador;

    @ManyToOne
    @JoinColumn(name = "rival_id")
    private Usuario rival;

    /** Lo que pone cada jugador. */
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal monto;

    @Column(nullable = false)
    private Integer puntos;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "varchar(20)")
    private EstadoMesa estado = EstadoMesa.ESPERANDO;

    @Column(length = 50)
    private String ganador;   // nombre que tenía al ganar (queda como registro)

    /** El ganador como usuario: sigue siendo él aunque después se cambie el nombre. */
    @ManyToOne
    @JoinColumn(name = "ganador_id")
    private Usuario ganadorUsuario;

    /** Lo que cobró el ganador (monto x 2 menos la comisión). */
    @Column(precision = 14, scale = 2)
    private BigDecimal premio;

    /** Lo que se queda el sitio. */
    @Column(precision = 14, scale = 2)
    private BigDecimal comision;

    @Column(nullable = false)
    private LocalDateTime creada = Movimiento.ahora();

    private LocalDateTime terminada;

    public MesaApuesta() {}

    public MesaApuesta(Usuario creador, BigDecimal monto, int puntos) {
        this.creador = creador;
        this.monto = monto;
        this.puntos = puntos;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Usuario getCreador() { return creador; }
    public Usuario getRival() { return rival; }
    public void setRival(Usuario rival) { this.rival = rival; }
    public BigDecimal getMonto() { return monto; }
    public Integer getPuntos() { return puntos; }
    public EstadoMesa getEstado() { return estado; }
    public void setEstado(EstadoMesa estado) { this.estado = estado; }
    public String getGanador() { return ganador; }
    public void setGanador(String ganador) { this.ganador = ganador; }
    public Usuario getGanadorUsuario() { return ganadorUsuario; }
    public void setGanadorUsuario(Usuario ganadorUsuario) { this.ganadorUsuario = ganadorUsuario; }

    /** Nombre actual del ganador (o el que tenía, para mesas viejas). */
    public String nombreGanador() { return ganadorUsuario != null ? ganadorUsuario.getUsername() : ganador; }
    public BigDecimal getPremio() { return premio; }
    public void setPremio(BigDecimal premio) { this.premio = premio; }
    public BigDecimal getComision() { return comision; }
    public void setComision(BigDecimal comision) { this.comision = comision; }
    public LocalDateTime getCreada() { return creada; }
    public LocalDateTime getTerminada() { return terminada; }
    public void setTerminada(LocalDateTime terminada) { this.terminada = terminada; }
}
