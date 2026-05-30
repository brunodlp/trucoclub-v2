package com.trucoclub.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.ArrayList;
import java.util.List;

public class Partida {
    private Jugador jugador1;
    private Jugador jugador2;
    private Jugador repartidor;
    private Jugador mano;
    private Jugador turnoActual;
    private Jugador elQueAbrioLaMano;
    private List<Carta> cartasEnMesa = new ArrayList<>();

    private Jugador ganadorPrimera = null;
    private Jugador ganadorSegunda = null;
    private int manoActual = 1;


    // --- ESTADO DEL JUEGO (Lo nuevo) ---
    private EstadoJuego estadoActual;
    private Jugador quienDebeResponder;

    // --- VARIABLES DE ENVIDO ---
    private int puntosEnJuegoEnvido = 0;
    private int puntosAnterioresEnvido = 0;
    private boolean envidoCerrado = false;
    private Jugador jugadorQueTeniaElTurnoAntesDelEnvido;
    private String ultimoGrito = "";

    // --- VARIABLES DE TRUCO ---
    private int puntosEnJuegoTruco = 1;
    private int puntosPropuestosTruco = 1;
    private Jugador quienTieneElQuieroTruco = null;
    private boolean trucoGritadoPendiente = false; // Para recordar que hay un Truco en pausa

    @JsonIgnore // Evita que el mazo viaje al frontend y cause bucles
    private Mazo mazo;

    private int puntosPartido;

    public Partida(Jugador j1, Jugador j2, int puntos) {
        this.jugador1 = j1;
        this.jugador2 = j2;
        this.puntosPartido = puntos;
        this.mazo = new Mazo();
        this.repartidor = (Math.random() > 0.5) ? j1 : j2;
        actualizarRoles();
        this.estadoActual = EstadoJuego.ESPERANDO_CARTA;
    }

    public Jugador getJugador1() {
        return jugador1;
    }

    public Jugador getJugador2() {
        return jugador2;
    }

    public Jugador getRepartidor() {
        return repartidor;
    }

    public Jugador getMano() {
        return mano;
    }

    public String getUltimoGrito() {
        return ultimoGrito;
    }

    public Jugador getTurnoActual() {
        return turnoActual;
    }

    public Jugador getElQueAbrioLaMano() {
        return elQueAbrioLaMano;
    }

    public List<Carta> getCartasEnMesa() {
        return cartasEnMesa;
    }

    public Jugador getGanadorPrimera() {
        return ganadorPrimera;
    }

    public Jugador getGanadorSegunda() {
        return ganadorSegunda;
    }

    public int getManoActual() {
        return manoActual;
    }

    public EstadoJuego getEstadoActual() {
        return estadoActual;
    }

    public Jugador getQuienDebeResponder() {
        return quienDebeResponder;
    }

    public int getPuntosEnJuegoEnvido() {
        return puntosEnJuegoEnvido;
    }

    public int getPuntosAnterioresEnvido() {
        return puntosAnterioresEnvido;
    }

    public boolean isEnvidoCerrado() {
        return envidoCerrado;
    }

    public int getPuntosEnJuegoTruco() {
        return puntosEnJuegoTruco;
    }

    public Jugador getQuienTieneElQuieroTruco() {
        return quienTieneElQuieroTruco;
    }

    public boolean isTrucoGritadoPendiente() {
        return trucoGritadoPendiente;
    }

    public Mazo getMazo() {
        return mazo;
    }

    public int getPuntosPartido() {
        return puntosPartido;
    }


    //------------------------------------------------------------------------------

    public void empezarRonda() {

        if (this.estadoActual == EstadoJuego.TERMINADO) return;

        this.manoActual = 1;
        this.ganadorPrimera = null;
        this.ganadorSegunda = null;
        this.cartasEnMesa.clear();

        // Reset Envido
        this.envidoCerrado = false;
        this.puntosEnJuegoEnvido = 0;
        this.puntosAnterioresEnvido = 0;

        // Reset Truco
        this.puntosEnJuegoTruco = 1;
        this.puntosPropuestosTruco = 1;
        this.quienTieneElQuieroTruco = null;
        this.trucoGritadoPendiente = false;
        this.ultimoGrito = "";

        // Reset Estados
        this.estadoActual = EstadoJuego.ESPERANDO_CARTA;
        this.quienDebeResponder = null;

        repartirCartas();
        this.turnoActual = mano;
        this.elQueAbrioLaMano = mano;

        System.out.println("--- Nueva ronda iniciada. Turno de: " + turnoActual.getNombre() + " ---");
    }

    // --- LÓGICA DE JUGADA (Tirar carta) ---
    public void realizarJugada(Jugador j, int indiceCarta) {
        // CANDADO: Si terminó o no es el turno, afuera
        if (estadoActual == EstadoJuego.TERMINADO || j != turnoActual)
            return;
        if (estadoActual != EstadoJuego.ESPERANDO_CARTA) {
            System.out.println("⚠️ No podés tirar carta, hay un grito pendiente.");
            return;
        }

        if (j == turnoActual && indiceCarta >= 0 && indiceCarta < j.getMano().size()) {
            Carta cartaTirada = j.jugarCarta(indiceCarta);
            cartasEnMesa.add(cartaTirada);
            System.out.println(j.getNombre() + " tiró " + cartaTirada);

            if (cartasEnMesa.size() == 2) {
                this.envidoCerrado = true; // El envido se cierra al tirar la 2da carta
            }

            if (cartasEnMesa.size() == 1) {
                cambiarTurno();
            } else {
                Jugador ganadorDeEsteDuelo = definirGanadorMano(
                        cartasEnMesa.get(0), elQueAbrioLaMano,
                        cartasEnMesa.get(1), (elQueAbrioLaMano == jugador1 ? jugador2 : jugador1));

                cartasEnMesa.clear();
                procesarResultadoMano(ganadorDeEsteDuelo);
            }
        }
    }

    // --- LÓGICA DE GRITOS (Cantar) ---
    public void cantarEnvido(Jugador elQueCanta, String tipoGrito) {
        if (estadoActual == EstadoJuego.TERMINADO) {
            System.out.println("La partida ya terminó. No se pueden realizar más acciones.");
            return;
        }

        // El envido solo se puede cantar en la primera mano y si no se cerró antes
        if (manoActual != 1 || envidoCerrado) {
            System.out.println("No se puede cantar envido ahora.");
            return;
        }

        // 1. IMPORTANTE: Guardamos quién tenía el turno original
        this.jugadorQueTeniaElTurnoAntesDelEnvido = this.turnoActual;

        // 2. Lógica de puntos acumulados para el "No quiero"
        // Si puntosEnJuegoEnvido es 0, es el primer grito -> el 'no quiero' vale 1.
        // Si ya había puntos, el 'no quiero' vale lo que se había gritado antes.
        if (puntosEnJuegoEnvido == 0) {
            puntosAnterioresEnvido = 1;
        } else {
            puntosAnterioresEnvido = puntosEnJuegoEnvido;
        }

        // 3. Incremento según el grito
        switch (tipoGrito.toLowerCase()) {
            case "envido":
                puntosEnJuegoEnvido += 2;
                break;
            case "real envido":
                puntosEnJuegoEnvido += 3;
                break;
            case "falta envido":
                puntosEnJuegoEnvido = calcularPuntosFaltaEnvido();
                break;
        }

        // 4. Cambio de estado y asignación de respuesta
        this.estadoActual = EstadoJuego.ESPERANDO_RESPUESTA_ENVIDO;
        this.quienDebeResponder = (elQueCanta == jugador1) ? jugador2 : jugador1;
        this.ultimoGrito = tipoGrito.toUpperCase();
        System.out.println("📣 " + elQueCanta.getNombre() + " cantó " + tipoGrito.toUpperCase());
    }

    public void cantarTruco(Jugador elQueCanta, String tipoGrito) {
        if (estadoActual == EstadoJuego.TERMINADO) return;

        if (puntosEnJuegoTruco == 4 || (quienTieneElQuieroTruco != null && elQueCanta != quienTieneElQuieroTruco)) {
            System.out.println("⚠️ No podés cantar truco ahora.");
            return;
        }

        // Asignamos el valor de la propuesta según el grito
        String grito = tipoGrito.toLowerCase();
        if (grito.equals("truco")) this.puntosPropuestosTruco = 2;
        else if (grito.equals("retruco")) this.puntosPropuestosTruco = 3;
        else if (grito.equals("vale cuatro")) this.puntosPropuestosTruco = 4;

        // Radar para la consola
        System.out.println("⚖️ MATEMÁTICA - " + elQueCanta.getNombre() + " gritó: " + grito.toUpperCase());
        System.out.println("⚖️ MATEMÁTICA - Puntos Propuestos en la mesa son: " + this.puntosPropuestosTruco);

        this.estadoActual = EstadoJuego.ESPERANDO_RESPUESTA_TRUCO;
        this.quienDebeResponder = (elQueCanta == jugador1) ? jugador2 : jugador1;
        this.ultimoGrito = tipoGrito.toUpperCase();
    }

    public void irseAlMazo(Jugador j) {
        if (estadoActual == EstadoJuego.TERMINADO) return;

        Jugador ganador = (j == jugador1) ? jugador2 : jugador1;
        int puntosACobrar;

        // 1. Si el truco ya se aceptó y vale más de 1, SIEMPRE se cobra el valor del Truco
        if (this.puntosEnJuegoTruco > 1) {
            puntosACobrar = this.puntosEnJuegoTruco;
            System.out.println("🏳️ " + j.getNombre() + " se fue al mazo con apuestas hechas. El rival gana " + puntosACobrar);
        }
        // 2. Regla especial: Si nadie cantó truco y se van al mazo en la primera mano sin tirar cartas
        else if (manoActual == 1 && cartasEnMesa.isEmpty() && !this.envidoCerrado) {
            puntosACobrar = 2;
            System.out.println("🏳️ " + j.getNombre() + " se fue al mazo antes de jugar. Penalidad: 2 puntos.");
        }
        // 3. Flujo normal (ya jugaron cartas y nadie cantó truco)
        else {
            puntosACobrar = this.puntosEnJuegoTruco; // Que será 1
            System.out.println("🏳️ " + j.getNombre() + " se fue al mazo. El rival gana " + puntosACobrar);
        }

        finalizarRonda(ganador, puntosACobrar);
    }

    // --- MÉTODO UNIFICADO DE RESPUESTA ---
    public void responder(Jugador j, String respuesta) {
        if (estadoActual == EstadoJuego.TERMINADO) {
            System.out.println("La partida ya terminó. No se pueden realizar más acciones.");
            return;
        }
        if (j != quienDebeResponder) {
            System.out.println("No es tu turno de responder.");
            return;
        }

        // --- CASO ESPECIAL: Envido como respuesta al Truco ---
        if (estadoActual == EstadoJuego.ESPERANDO_RESPUESTA_TRUCO && esUnRecantoDeEnvido(respuesta)) {
            System.out.println("⚠️ El Truco queda en pausa. Primero resolvemos el Envido.");
            this.trucoGritadoPendiente = true; // Guardamos en memoria que hay un Truco pendiente
            cantarEnvido(j, respuesta); // Esto cambia el estado a ESPERANDO_RESPUESTA_ENVIDO
            return;
        }

        if (estadoActual == EstadoJuego.ESPERANDO_RESPUESTA_ENVIDO) {
            procesarRespuestaEnvido(j, respuesta);
        } else if (estadoActual == EstadoJuego.ESPERANDO_RESPUESTA_TRUCO) {
            procesarRespuestaTruco(j, respuesta);
        }
    }

    private void procesarRespuestaEnvido(Jugador j, String respuesta) {
        if (respuesta.equalsIgnoreCase("quiero")) {
            Jugador ganador = definirGanadorEnvido();
            sumarPuntosJugador(ganador, puntosEnJuegoEnvido);
            this.envidoCerrado = true;
            this.quienDebeResponder = null;

            // --- EL FRENO DE MANO AQUÍ ---
            if (this.estadoActual == EstadoJuego.TERMINADO) {
                return; // Si ya hay campeón, NO llamamos a volverAlEstadoAnterior
            }

            volverAlEstadoAnterior(j);

        } else if (respuesta.equalsIgnoreCase("no quiero")) {
            Jugador elQueCanto = (j == jugador1) ? jugador2 : jugador1;
            int puntosParaElQueCanto = (puntosAnterioresEnvido == 0) ? 1 : puntosAnterioresEnvido;
            sumarPuntosJugador(elQueCanto, puntosParaElQueCanto);
            this.envidoCerrado = true;
            this.quienDebeResponder = null;

            // --- EL FRENO DE MANO AQUÍ TAMBIÉN ---
            if (this.estadoActual == EstadoJuego.TERMINADO) {
                return;
            }

            volverAlEstadoAnterior(j);

        } else {
            cantarEnvido(j, respuesta);
        }
    }

    /**
     * Método auxiliar para no repetir código y manejar el retorno de estado y
     * turnos
     */
    private void volverAlEstadoAnterior(Jugador j) {
        // Si el juego terminó, NO HACEMOS NADA.
        if (this.estadoActual == EstadoJuego.TERMINADO) {
            this.turnoActual = null;
            this.quienDebeResponder = null;
            return;
        }

        if (jugador1.getMano().isEmpty() && jugador2.getMano().isEmpty()) {
            Jugador ganadorRonda = (ganadorPrimera != null) ? ganadorPrimera : this.mano;
            finalizarRonda(ganadorRonda);
            return;
        }

        if (trucoGritadoPendiente) {
            this.estadoActual = EstadoJuego.ESPERANDO_RESPUESTA_TRUCO;
            this.quienDebeResponder = (j == jugador1) ? jugador2 : jugador1;
        } else {
            this.estadoActual = EstadoJuego.ESPERANDO_CARTA;
            this.turnoActual = this.jugadorQueTeniaElTurnoAntesDelEnvido;
        }
    }

    private boolean rondaDeberiaFinalizar() {
        // Si estamos en la mano 3 y ya hay cartas en la mesa de esta mano
        // O si alguien ya ganó 2 manos de 3.
        // Una forma simple es ver si los jugadores ya no tienen cartas:
        return jugador1.getMano().isEmpty() && jugador2.getMano().isEmpty();
    }

    private void procesarRespuestaTruco(Jugador j, String respuesta) {
        System.out.println("⚖️ MATEMÁTICA - Respuesta recibida: " + respuesta);

        if (respuesta.equalsIgnoreCase("quiero")) {
            // Si acepta, oficializamos la apuesta
            this.puntosEnJuegoTruco = this.puntosPropuestosTruco;

            this.quienTieneElQuieroTruco = (j == jugador1) ? jugador1 : jugador2;
            this.quienDebeResponder = null;
            this.trucoGritadoPendiente = false;

            if (rondaDeberiaFinalizar()) {
                Jugador ganadorRonda = (ganadorPrimera != null) ? ganadorPrimera : this.mano;
                finalizarRonda(ganadorRonda);
            } else {
                this.estadoActual = EstadoJuego.ESPERANDO_CARTA;
            }

        } else if (respuesta.equalsIgnoreCase("no quiero")) {
            Jugador ganador = (j == jugador1) ? jugador2 : jugador1;

            // LA LÍNEA CRÍTICA: Cobramos 1 punto menos de lo que se propuso
            int puntosACobrar = this.puntosPropuestosTruco - 1;

            System.out.println("⚖️ MATEMÁTICA - No quiso. Se habían propuesto: " + this.puntosPropuestosTruco + " -> El ganador cobra: " + puntosACobrar);

            finalizarRonda(ganador, puntosACobrar);

        } else if (esUnRecantoDeTruco(respuesta)) {
            cantarTruco(j, respuesta);
        }
    }

    // --- MÉTODOS DE APOYO (Definiciones de ganadores, puntos, etc.) ---
    public void procesarResultadoMano(Jugador ganadorMano) {
        System.out.println(
                "Resultado Mano " + manoActual + ": " + (ganadorMano == null ? "Parda" : ganadorMano.getNombre()));

        if (manoActual == 1) {
            ganadorPrimera = ganadorMano;
            manoActual = 2;
            this.turnoActual = (ganadorMano != null) ? ganadorMano : this.mano;
            this.elQueAbrioLaMano = this.turnoActual;

        } else if (manoActual == 2) {
            ganadorSegunda = ganadorMano;
            if (ganadorMano == null) {
                if (ganadorPrimera != null)
                    finalizarRonda(ganadorPrimera);
                else {
                    manoActual = 3;
                    this.turnoActual = mano;
                    this.elQueAbrioLaMano = mano;
                }
            } else {
                if (ganadorPrimera == null || ganadorPrimera == ganadorMano)
                    finalizarRonda(ganadorMano);
                else {
                    manoActual = 3;
                    this.turnoActual = ganadorMano;
                    this.elQueAbrioLaMano = turnoActual;
                }
            }

        } else if (manoActual == 3) {
            if (ganadorMano != null)
                finalizarRonda(ganadorMano);
            else
                finalizarRonda(ganadorPrimera != null ? ganadorPrimera : this.mano);
        }
    }

    private void finalizarRonda(Jugador ganadorRonda, int puntosAñadir) {
        // 1. Sumamos los puntos
        sumarPuntosJugador(ganadorRonda, puntosAñadir);

        // 2. Si terminó el partido, morimos acá
        if (this.estadoActual == EstadoJuego.TERMINADO) {
            System.out.println("!!! PARTIDA FINALIZADA - NO SE REPARTE MÁS !!!");
            this.turnoActual = null;
            this.quienDebeResponder = null;
            return;
        }

        // 3. 👇 ACÁ CAMBIA LA OPCIÓN 2 👇
        // En vez de rotar y repartir ya mismo, ponemos pausa para que el frontend respire
        this.estadoActual = EstadoJuego.ENTRE_MANOS;
        this.turnoActual = null; // Nadie puede tirar cartas en el entretiempo
        this.quienDebeResponder = null;

        System.out.println("⏳ Ronda terminada. Esperando confirmación del frontend para repartir...");
    }

    private void finalizarRonda(Jugador ganadorRonda) {
        finalizarRonda(ganadorRonda, this.puntosEnJuegoTruco);
    }

    public Jugador definirGanadorEnvido() {
        int p1 = jugador1.calcularEnvido();
        int p2 = jugador2.calcularEnvido();
        System.out.println(
                "Envido: " + jugador1.getNombre() + " (" + p1 + ") vs " + jugador2.getNombre() + " (" + p2 + ")");
        if (p1 > p2)
            return jugador1;
        if (p2 > p1)
            return jugador2;
        return this.mano;
    }

    public Jugador definirGanadorMano(Carta c1, Jugador j1, Carta c2, Jugador j2) {
        if (c1.getJerarquiaTruco() > c2.getJerarquiaTruco())
            return j1;
        if (c2.getJerarquiaTruco() > c1.getJerarquiaTruco())
            return j2;
        return null;
    }

    private int calcularPuntosFaltaEnvido() {
        int puntajeMax = Math.max(jugador1.getPuntos(), jugador2.getPuntos());
        return puntosPartido - puntajeMax;
    }

    private void sumarPuntosJugador(Jugador j, int cantidad) {
        j.sumarPuntos(cantidad);
        System.out.println("📈 Puntos para " + j.getNombre() + ": +" + cantidad);

        if (j.getPuntos() >= puntosPartido) {
            System.out.println("🏆 ¡CAMPEÓN: " + j.getNombre().toUpperCase() + "!");
            this.estadoActual = EstadoJuego.TERMINADO;
            this.quienDebeResponder = null; // Limpieza vital
            this.turnoActual = null;        // Limpieza vital
        }
    }

    public void cambiarTurno() {
        this.turnoActual = (turnoActual == jugador1) ? jugador2 : jugador1;
    }

    private void actualizarRoles() {
        mano = (repartidor == jugador1) ? jugador2 : jugador1;
    }

    public void rotarRepartidor() {
        this.repartidor = (repartidor == jugador1) ? jugador2 : jugador1;
        actualizarRoles();
    }

    public void repartirCartas() {
        jugador1.getMano().clear();
        jugador2.getMano().clear();
        jugador1.getCartasJugadas().clear();
        jugador2.getCartasJugadas().clear();
        this.mazo = new Mazo();
        mazo.barajar();
        for (int i = 0; i < 3; i++) {
            mano.recibirCarta(mazo.repartir());
            repartidor.recibirCarta(mazo.repartir());
        }
    }

    private boolean esUnRecantoDeEnvido(String r) {
        String resp = r.toLowerCase();
        return resp.equals("envido") ||
                resp.equals("real envido") ||
                resp.equals("falta envido");
    }

    private boolean esUnRecantoDeTruco(String r) {
        String resp = r.toLowerCase();
        return resp.equals("truco") ||
                resp.equals("retruco") ||
                resp.equals("vale cuatro");
    }



    // Agregá este método al final de tu clase Partida.java
    public void avanzarSiguienteMano() {
        // Candado de seguridad: solo avanzamos si realmente estábamos esperando
        if (this.estadoActual != EstadoJuego.ENTRE_MANOS) {
            return;
        }

        // Ahora sí, hacemos lo que antes hacíamos automático
        rotarRepartidor();
        empezarRonda();
    }

}

