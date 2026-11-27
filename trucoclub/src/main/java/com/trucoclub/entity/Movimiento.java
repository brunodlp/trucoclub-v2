package com.trucoclub.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Un pedido de depósito o de retiro. Nunca se borra: queda como registro de todo lo que pasó
 * con la plata de cada usuario (quién lo pidió, cuánto, quién lo aprobó y cuándo).
 */
@Entity
@Table(name = "movimientos")
public class Movimiento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "varchar(20)")
    private TipoMovimiento tipo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "varchar(20)")
    private EstadoMovimiento estado = EstadoMovimiento.PENDIENTE;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal monto;

    /** Depósito: número de operación de la transferencia. Retiro: alias o CBU/CVU donde mandar la plata. */
    @Column(nullable = false, length = 60)
    private String detalle;

    /** Saldo del usuario justo después de que este movimiento lo cambió. */
    @Column(precision = 14, scale = 2)
    private BigDecimal saldoDespues;

    @Column(length = 200)
    private String motivoRechazo;

    @Column(nullable = false)
    private LocalDateTime creado = ahora();

    private LocalDateTime resuelto;

    /** Admin que lo aprobó o rechazó. */
    @Column(length = 50)
    private String resueltoPor;

    /** Hora de Argentina, aunque el servidor esté en otro país (Render usa UTC). */
    public static LocalDateTime ahora() {
        return LocalDateTime.now(ZoneId.of("America/Argentina/Buenos_Aires"));
    }

    public Movimiento() {}

    public Movimiento(Usuario usuario, TipoMovimiento tipo, BigDecimal monto, String detalle) {
        this.usuario = usuario;
        this.tipo = tipo;
        this.monto = monto;
        this.detalle = detalle;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Usuario getUsuario() { return usuario; }
    public TipoMovimiento getTipo() { return tipo; }
    public EstadoMovimiento getEstado() { return estado; }
    public void setEstado(EstadoMovimiento estado) { this.estado = estado; }
    public BigDecimal getMonto() { return monto; }
    public String getDetalle() { return detalle; }
    public BigDecimal getSaldoDespues() { return saldoDespues; }
    public void setSaldoDespues(BigDecimal saldoDespues) { this.saldoDespues = saldoDespues; }
    public String getMotivoRechazo() { return motivoRechazo; }
    public void setMotivoRechazo(String motivoRechazo) { this.motivoRechazo = motivoRechazo; }
    public LocalDateTime getCreado() { return creado; }
    public LocalDateTime getResuelto() { return resuelto; }
    public void setResuelto(LocalDateTime resuelto) { this.resuelto = resuelto; }
    public String getResueltoPor() { return resueltoPor; }
    public void setResueltoPor(String resueltoPor) { this.resueltoPor = resueltoPor; }
}
