package com.trucoclub.model;

public class MensajeAccion {
    private String mesaId;
    private String nombreJugador;
    private String accion; // Acá va a venir "envido", "truco", "quiero", "irse_al_mazo", etc.

    // Constructores
    public MensajeAccion() {}

    public MensajeAccion(String mesaId, String nombreJugador, String accion) {
        this.mesaId = mesaId;
        this.nombreJugador = nombreJugador;
        this.accion = accion;
    }

    // Getters y Setters
    public String getMesaId() { return mesaId; }
    public void setMesaId(String mesaId) { this.mesaId = mesaId; }

    public String getNombreJugador() { return nombreJugador; }
    public void setNombreJugador(String nombreJugador) { this.nombreJugador = nombreJugador; }

    public String getAccion() { return accion; }
    public void setAccion(String accion) { this.accion = accion; }
}
