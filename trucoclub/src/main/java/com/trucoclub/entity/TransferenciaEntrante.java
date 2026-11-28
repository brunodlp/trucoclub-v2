package com.trucoclub.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Una transferencia que entró a la cuenta del sitio. La avisa el banco (webhook) o la carga un admin.
 * Si el CUIL de quien transfirió coincide con el DNI de un jugador, se le acredita automáticamente.
 */
@Entity
@Table(name = "transferencias_entrantes")
public class TransferenciaEntrante {

    public enum Estado {
        ACREDITADA,       // se encontró al jugador por DNI y se le acreditó sola
        SIN_IDENTIFICAR,  // no coincide con ningún jugador: la revisa un admin
        ASIGNADA,         // un admin se la acreditó a un jugador a mano
        DEVUELTA          // un admin la devolvió a quien la mandó
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Id de la transferencia en el banco. Único: si el aviso llega dos veces, la segunda se ignora. */
    @Column(name = "id_externo", nullable = false, unique = true, length = 100)
    private String idExterno;

    @Column(nullable = false, length = 20)
    private String proveedor;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal monto;

    @Column(name = "cuit_originante", length = 11)
    private String cuitOriginante;

    @Column(name = "nombre_originante", length = 120)
    private String nombreOriginante;

    @Column(name = "dni_detectado", length = 8)
    private String dniDetectado;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "varchar(20)")
    private Estado estado;

    @ManyToOne
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @ManyToOne
    @JoinColumn(name = "movimiento_id")
    private Movimiento movimiento;

    @Column(length = 200)
    private String nota;

    @Column(nullable = false)
    private LocalDateTime recibida = Movimiento.ahora();

    private LocalDateTime resuelta;

    @Column(name = "resuelto_por", length = 50)
    private String resueltoPor;

    public TransferenciaEntrante() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getIdExterno() { return idExterno; }
    public void setIdExterno(String idExterno) { this.idExterno = idExterno; }
    public String getProveedor() { return proveedor; }
    public void setProveedor(String proveedor) { this.proveedor = proveedor; }
    public BigDecimal getMonto() { return monto; }
    public void setMonto(BigDecimal monto) { this.monto = monto; }
    public String getCuitOriginante() { return cuitOriginante; }
    public void setCuitOriginante(String cuitOriginante) { this.cuitOriginante = cuitOriginante; }
    public String getNombreOriginante() { return nombreOriginante; }
    public void setNombreOriginante(String nombreOriginante) { this.nombreOriginante = nombreOriginante; }
    public String getDniDetectado() { return dniDetectado; }
    public void setDniDetectado(String dniDetectado) { this.dniDetectado = dniDetectado; }
    public Estado getEstado() { return estado; }
    public void setEstado(Estado estado) { this.estado = estado; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public Movimiento getMovimiento() { return movimiento; }
    public void setMovimiento(Movimiento movimiento) { this.movimiento = movimiento; }
    public String getNota() { return nota; }
    public void setNota(String nota) { this.nota = nota; }
    public LocalDateTime getRecibida() { return recibida; }
    public LocalDateTime getResuelta() { return resuelta; }
    public void setResuelta(LocalDateTime resuelta) { this.resuelta = resuelta; }
    public String getResueltoPor() { return resueltoPor; }
    public void setResueltoPor(String resueltoPor) { this.resueltoPor = resueltoPor; }
}
