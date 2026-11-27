package com.trucoclub.dto;

import com.trucoclub.model.Carta;
import com.trucoclub.model.EstadoJuego;
import com.trucoclub.model.Jugador;
import com.trucoclub.model.Partida;

import java.util.List;

/**
 * Lo que ve UN jugador de la partida. A diferencia de mandar la Partida entera,
 * acá el rival viaja sin sus cartas en mano (solo cuántas le quedan), así nadie
 * puede espiarlas desde la consola del navegador.
 */
public record VistaPartida(
        String mesaId,
        String asiento,               // "j1" o "j2"
        String estado,
        int puntosPartido,
        int numeroRonda,
        int manoActual,               // baza actual: 1, 2 o 3
        VistaYo yo,
        VistaRival rival,
        String turno,                 // nombre de quien tiene que tirar
        String debeResponder,         // nombre de quien tiene que contestar un canto
        String esMano,                // nombre del que es mano en esta ronda
        String ultimoGrito,           // canto pendiente: "TRUCO", "REAL ENVIDO"...
        int puntosEnJuegoTruco,
        int puntosPropuestosTruco,
        String quienTieneElQuieroTruco,
        boolean trucoPendiente,       // hay un truco en pausa mientras se resuelve el envido
        boolean envidoCerrado,
        int puntosEnJuegoEnvido,
        int cantoSeq,
        String cantoTexto,
        String cantoDe,
        String ultimoEvento,
        List<String> resultadosBazas,
        String ganadorUltimaRonda,
        int puntosUltimaRonda,
        String ganadorPartido,
        int envidoSeq,                // sube cada vez que se cantan los tantos
        List<Partida.CantoEnvido> envidoCantos, // [mano: "27", pie: "SON BUENAS"]
        int versionAccion,
        long msRestantes,             // milisegundos que le quedan al que tiene que actuar (-1 = sin reloj)
        boolean cartaEnMesaEsCuatro,  // si te tiraron un 4 no podés cantar nada
        Partida.MuestraEnvido envidoMostrado, // cartas del que ganó el envido (solo en la pausa entre manos)
        String abandonoDe,            // nombre del que abandonó la partida (o null)
        List<String> abreBazas,       // quién tiró primero en cada baza (para apilar las cartas en orden)
        java.math.BigDecimal monto,   // lo que puso cada uno
        java.math.BigDecimal premio   // lo que cobra el ganador
) {

    public record VistaYo(String nombre, int puntos, int tantos, List<Carta> mano, List<Carta> cartasJugadas) {
    }

    public record VistaRival(String nombre, int puntos, int cartasEnMano, List<Carta> cartasJugadas) {
    }

    public static VistaPartida de(String mesaId, Partida p, String asiento) {
        boolean soyJ1 = "j1".equals(asiento);
        Jugador yo = soyJ1 ? p.getJugador1() : p.getJugador2();
        Jugador rival = soyJ1 ? p.getJugador2() : p.getJugador1();
        boolean esperando = p.getEstadoActual() == EstadoJuego.ESPERANDO_JUGADORES;

        return new VistaPartida(
                mesaId,
                asiento,
                p.getEstadoActual().name(),
                p.getPuntosPartido(),
                p.getNumeroRonda(),
                p.getManoActual(),
                new VistaYo(yo.getNombre(), yo.getPuntos(), esperando ? 0 : yo.calcularEnvido(),
                        List.copyOf(yo.getMano()), List.copyOf(yo.getCartasJugadas())),
                new VistaRival(esperando ? null : rival.getNombre(), rival.getPuntos(), rival.getMano().size(),
                        List.copyOf(rival.getCartasJugadas())),
                nombre(p.getTurnoActual()),
                nombre(p.getQuienDebeResponder()),
                esperando ? null : nombre(p.getMano()),
                p.getUltimoGrito(),
                p.getPuntosEnJuegoTruco(),
                p.getPuntosPropuestosTruco(),
                nombre(p.getQuienTieneElQuieroTruco()),
                p.isTrucoGritadoPendiente(),
                p.isEnvidoCerrado(),
                p.getPuntosEnJuegoEnvido(),
                p.getCantoSeq(),
                p.getCantoTexto(),
                p.getCantoDe(),
                p.getUltimoEvento(),
                List.copyOf(p.getResultadosBazas()),
                p.getGanadorUltimaRonda(),
                p.getPuntosUltimaRonda(),
                p.getGanadorPartido(),
                p.getEnvidoSeq(),
                List.copyOf(p.getEnvidoCantos()),
                p.getVersionAccion(),
                p.getVenceTurnoEn() > 0 ? Math.max(0, p.getVenceTurnoEn() - System.currentTimeMillis()) : -1,
                p.cartaEnMesaEsCuatro(),
                p.getEstadoActual() == EstadoJuego.ENTRE_MANOS ? p.getEnvidoMostrar() : null,
                p.getAbandonoDe(),
                List.copyOf(p.getAbreBazas()),
                p.getMonto(),
                p.getPremio()
        );
    }

    private static String nombre(Jugador j) {
        return j == null ? null : j.getNombre();
    }
}
