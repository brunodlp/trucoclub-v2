package com.trucoclub.service;

import com.trucoclub.model.EstadoJuego;
import com.trucoclub.model.MensajeAccion;
import com.trucoclub.model.Partida;
import com.trucoclub.model.Jugador;
import org.springframework.stereotype.Service;
import java.util.HashMap;
import java.util.Map;

@Service
public class TrucoService {
    // Diccionario para manejar varias mesas a la vez
    private Map<String, Partida> partidasActivas = new HashMap<>();

    public String crearNuevaPartida(String nombreJ1, String nombreJ2, int puntosMax) {
        String idPartida = "mesa-" + (partidasActivas.size() + 1);

        // 1. Instanciamos los Jugadores (asumo que tu clase Jugador recibe el nombre)
        Jugador j1 = new Jugador(nombreJ1);
        Jugador j2 = new Jugador(nombreJ2);

        // 2. Usamos tu constructor real: Partida(Jugador j1, Jugador j2, int puntos)
        Partida nuevaPartida = new Partida(j1, j2, puntosMax);

        // 3. Tu método para mezclar, repartir y setear el turno de la mano
        nuevaPartida.empezarRonda();

        partidasActivas.put(idPartida, nuevaPartida);
        return idPartida;
    }

    public Partida obtenerPartida(String id) {
        return partidasActivas.get(id);
    }

    // Método para que el controlador le pase las acciones a tu lógica
    public Partida jugarCarta(String id, String nombreJugador, int indice) {
        Partida p = partidasActivas.get(id);
        if (p != null) {
            // Buscamos cuál de los dos jugadores es el que quiere tirar
            Jugador j = p.getJugador1().getNombre().equals(nombreJugador) ? p.getJugador1() : p.getJugador2();
            p.realizarJugada(j, indice);
        }
        return obtenerPartida(id);
    }
    public Partida avanzarSiguienteMano(String mesaId) {
        // Acá usás la lógica que ya tengas para buscar la partida (ej: partidasMap.get(mesaId))
        Partida partida = obtenerPartida(mesaId);

        if (partida != null) {
            partida.avanzarSiguienteMano(); // El método que modificamos en la clase Partida
        }

        return partida;
    }

    // --- LÓGICA DE GRITOS (Envido, Truco, Mazo) ---
    public Partida procesarCanto(MensajeAccion mensaje) {
        Partida partida = obtenerPartida(mensaje.getMesaId());
        if (partida == null) return null;

        Jugador jugador = obtenerJugadorPorNombre(partida, mensaje.getNombreJugador());
        if (jugador == null) return partida;

        String accion = mensaje.getAccion().toLowerCase();

        if (accion.equals("irse_al_mazo")) {
            partida.irseAlMazo(jugador);
        } else if (accion.contains("envido")) {
            partida.cantarEnvido(jugador, accion);
        } else if (accion.contains("truco")) {
            partida.cantarTruco(jugador, accion);
        }

        return partida;
    }

    // --- LÓGICA DE RESPUESTAS (Quiero, No quiero, Retruco) ---
    public Partida procesarRespuesta(MensajeAccion mensaje) {
        Partida partida = obtenerPartida(mensaje.getMesaId());
        if (partida == null) return null;

        Jugador jugador = obtenerJugadorPorNombre(partida, mensaje.getNombreJugador());
        if (jugador == null) return partida;

        partida.responder(jugador, mensaje.getAccion());

        return partida;
    }

    // --- MÉTODO AUXILIAR PARA BUSCAR AL JUGADOR ---
    private Jugador obtenerJugadorPorNombre(Partida partida, String nombre) {
        if (partida.getJugador1().getNombre().equals(nombre)) return partida.getJugador1();
        if (partida.getJugador2().getNombre().equals(nombre)) return partida.getJugador2();
        return null;
    }

    public Partida renombrarJugador2(String mesaId, String nuevoNombre) {
        // Buscamos la mesa con el método que ya tenés
        Partida partida = obtenerPartida(mesaId);

        if (partida != null) {
            // Le cambiamos el nombre al Jugador 2
            partida.getJugador2().setNombre(nuevoNombre);

            // Opcional y recomendado: Si la mesa estaba esperando, la arrancamos
            if (partida.getEstadoActual() == EstadoJuego.ESPERANDO_JUGADORES) {
                partida.empezarRonda();
            }
        }
        return partida;
    }
}