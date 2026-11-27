package com.trucoclub.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/** Aviso para un jugador: "Te acreditamos tu depósito", "Ganaste $9.500", etc. */
@Entity
@Table(name = "notificaciones")
public class Notificacion {

    /** Para elegir el ícono en el front. */
    public enum Tipo { OK, ERROR, PREMIO, INFO }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "varchar(20)")
    private Tipo tipo;

    @Column(nullable = false, length = 300)
    private String texto;

    @Column(nullable = false)
    private boolean leida = false;

    @Column(nullable = false)
    private LocalDateTime creada = Movimiento.ahora();

    public Notificacion() {}

    public Notificacion(Usuario usuario, Tipo tipo, String texto) {
        this.usuario = usuario;
        this.tipo = tipo;
        this.texto = texto.length() > 300 ? texto.substring(0, 300) : texto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Usuario getUsuario() { return usuario; }
    public Tipo getTipo() { return tipo; }
    public String getTexto() { return texto; }
    public boolean isLeida() { return leida; }
    public void setLeida(boolean leida) { this.leida = leida; }
    public LocalDateTime getCreada() { return creada; }
}
