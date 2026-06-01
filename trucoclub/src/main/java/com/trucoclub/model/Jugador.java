package com.trucoclub.model;

import java.util.ArrayList;
import java.util.List;

public class Jugador {
    private String nombre;
    private List<Carta> mano; // las 3 cartas con la que jugaria la mano
    private int puntos; //inicia en 0
    private List<Carta> cartasJugadas = new ArrayList<>();

    public Jugador(String nombre) {
        this.nombre = nombre;
        this.mano = new ArrayList<>();
        this.puntos = 0;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre){
        this.nombre = nombre;
    }

    public int getPuntos() {
        return puntos;
    }

    public List<Carta> getMano() {
        return mano;
    }
    public List<Carta> getCartasJugadas() {
        return cartasJugadas;
    }

    public void recibirCarta(Carta c) {
        mano.add(c);
    }

    public int calcularEnvido() {
        int maxPuntaje = 0;

        // Juntamos TODAS las cartas de esta ronda para calcular bien los puntos
        List<Carta> todasLasCartas = new ArrayList<>();
        if (mano != null) todasLasCartas.addAll(mano);
        if (cartasJugadas != null) todasLasCartas.addAll(cartasJugadas);

        if (todasLasCartas.isEmpty()) return 0;

        // 1. Comparar combinaciones de a pares
        for (int i = 0; i < todasLasCartas.size(); i++) {
            for (int j = i + 1; j < todasLasCartas.size(); j++) {
                Carta c1 = todasLasCartas.get(i);
                Carta c2 = todasLasCartas.get(j);
                int puntajeCandidato;

                if (c1.getPalo().equals(c2.getPalo())) {
                    puntajeCandidato = 20 + c1.getValorEnvido() + c2.getValorEnvido();
                } else {
                    puntajeCandidato = Math.max(c1.getValorEnvido(), c2.getValorEnvido());
                }

                if (puntajeCandidato > maxPuntaje) {
                    maxPuntaje = puntajeCandidato;
                }
            }
        }

        // 2. Verificación final por carta individual alta
        for (Carta c : todasLasCartas) {
            if (c.getValorEnvido() > maxPuntaje) {
                maxPuntaje = c.getValorEnvido();
            }
        }

        return maxPuntaje;
    }

    // Método para jugar una carta y sacarla de la mano
    public Carta jugarCarta(int indice) {
        Carta carta = mano.remove(indice);
        cartasJugadas.add(carta);
        return carta;
    }

    public void sumarPuntos(int cantidad) {
        this.puntos += cantidad;
    }



}


