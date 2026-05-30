import { useState, useEffect } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

export default function Juego() {
  const [mesaId, setMesaId] = useState(null);
  const [inputMesaId, setInputMesaId] = useState("");
  const [partida, setPartida] = useState(null);
  const [stompClient, setStompClient] = useState(null);
  const [jugadorAsignado, setJugadorAsignado] = useState(null);

  // ==========================================
  // 1. CONEXIÓN INICIAL Y WEBSOCKETS
  // ==========================================
  useEffect(() => {
    if (!mesaId) return;

    const traerEstadoInicial = async () => {
      try {
        const res = await fetch(
          `https://trucoclub-backend.onrender.com/api/truco/estado/${mesaId}`,
        );
        if (res.ok) {
          const data = await res.json();
          setPartida(data);
        }
      } catch (err) {
        console.error("Error al traer estado inicial:", err);
      }
    };

    traerEstadoInicial();

    const socket = new SockJS(
      "https://trucoclub-backend.onrender.com/ws-truco",
    );
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("¡Conectado a los WebSockets del Truco!");
        client.subscribe(`/topic/partida/${mesaId}`, (message) => {
          const partidaActualizada = JSON.parse(message.body);
          setPartida(partidaActualizada);
        });
      },
    });

    client.activate();
    setStompClient(client);

    return () => {
      if (client) client.deactivate();
    };
  }, [mesaId]);

  // ==========================================
  // 2. EL CRONÓMETRO INVISIBLE (ENTRE MANOS)
  // ==========================================
  useEffect(() => {
    if (partida?.estadoActual === "ENTRE_MANOS") {
      const timer = setTimeout(() => {
        if (stompClient && stompClient.connected) {
          stompClient.publish({
            destination: `/app/partida/${mesaId}/siguiente`,
            body: JSON.stringify({}),
          });
        }
      }, 3000); // Frena 3 segundos para mostrar el resultado

      return () => clearTimeout(timer);
    }
  }, [partida?.estadoActual, stompClient, mesaId]);

  // ==========================================
  // 3. FUNCIONES DE ACCIÓN (DISPARADORES)
  // ==========================================
  const crearMesa = async () => {
    try {
      const res = await fetch(
        "https://trucoclub-backend.onrender.com/api/truco/nueva?j1=Nacho&j2=IA&puntos=30",
        { method: "POST" },
      );
      const id = await res.text();
      setMesaId(id);
      setJugadorAsignado("Nacho");
    } catch (err) {
      alert("Error: ¿Está el server de Java prendido?");
    }
  };

  const unirseMesa = () => {
    if (inputMesaId.trim() !== "") setMesaId(inputMesaId);
    else alert("Por favor, ingresá un ID de mesa válido.");
  };

  const tirarCarta = async (indice) => {
    // Validaciones: ¿Es mi turno? ¿Estamos en la etapa de tirar cartas?
    if (partida.estadoActual !== "ESPERANDO_CARTA") return;
    if (partida.turnoActual?.nombre !== jugadorAsignado) {
      alert("¡Pará un poco, no es tu turno!");
      return;
    }

    if (stompClient && stompClient.connected) {
      stompClient.publish({
        destination: `/app/jugar`,
        body: JSON.stringify({
          mesaId: mesaId,
          jugador: jugadorAsignado,
          cartaIndice: indice,
        }),
      });
    }
  };

  const gritar = (accion) => {
    console.log(
      `Intentando gritar: ${accion} en la mesa: ${mesaId} como ${jugadorAsignado}`,
    );

    if (stompClient && stompClient.connected) {
      stompClient.publish({
        destination: "/app/cantar",
        body: JSON.stringify({
          mesaId,
          nombreJugador: jugadorAsignado,
          accion,
        }),
      });
      console.log("Mensaje de grito enviado al servidor 🚀");
    } else {
      console.error("No hay conexión con el WebSocket :(");
    }
  };

  const responder = (accion) => {
    console.log(
      `Intentando responder: ${accion} en la mesa: ${mesaId} como ${jugadorAsignado}`,
    );

    if (stompClient && stompClient.connected) {
      stompClient.publish({
        destination: "/app/responder",
        body: JSON.stringify({
          mesaId,
          nombreJugador: jugadorAsignado,
          accion,
        }),
      });
      console.log("Mensaje de respuesta enviado al servidor 🚀");
    }
  };

  // ==========================================
  // 4. EXTRACCIÓN DE DATOS PARA DIBUJAR
  // ==========================================
  let miJugador = null;
  let rival = null;
  let esMiTurno = false;
  let meTocaResponder = false;

  if (partida && jugadorAsignado) {
    const soyJ1 = partida.jugador1.nombre === jugadorAsignado;
    miJugador = soyJ1 ? partida.jugador1 : partida.jugador2;
    rival = soyJ1 ? partida.jugador2 : partida.jugador1;

    esMiTurno = partida.turnoActual?.nombre === jugadorAsignado;
    meTocaResponder = partida.quienDebeResponder?.nombre === jugadorAsignado;
  }

  // ==========================================
  // 5. RENDERIZADO VISUAL
  // ==========================================
  return (
    <div className="min-h-screen bg-neutral-900 text-white p-8 text-center font-sans">
      <h1 className="text-4xl font-black text-green-500 mb-8 tracking-wider">
        Truco Club - MESA ONLINE 🃏
      </h1>

      {/* --- MENÚ DE ENTRADA --- */}
      {!mesaId ? (
        <div className="max-w-md mx-auto space-y-8">
          <button
            onClick={crearMesa}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-colors text-lg"
          >
            Crear Nueva Mesa
          </button>

          <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-xl">
            <p className="mb-4 text-neutral-300 font-medium">
              ¿Ya tenés el ID de una mesa?
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ej: mesa-123"
                value={inputMesaId}
                onChange={(e) => setInputMesaId(e.target.value)}
                className="flex-1 bg-neutral-900 border border-neutral-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={unirseMesa}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-colors"
              >
                Unirse
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <div className="bg-neutral-800 px-6 py-2 rounded-full mb-6 border border-neutral-700">
            Mesa ID:{" "}
            <span className="text-yellow-400 font-mono font-bold select-all">
              {mesaId}
            </span>
          </div>

          {/* --- SELECCIÓN DE JUGADOR --- */}
          {partida && !jugadorAsignado && (
            <div className="bg-neutral-800 p-8 rounded-2xl border border-neutral-700 shadow-2xl max-w-sm w-full my-10">
              <h3 className="text-xl font-bold mb-6">
                ¿Quién sos en esta pestaña?
              </h3>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setJugadorAsignado(partida.jugador1.nombre)}
                  className="bg-green-600 hover:bg-green-500 font-bold py-3 rounded-lg transition-colors"
                >
                  {partida.jugador1.nombre}
                </button>
                <button
                  onClick={() => setJugadorAsignado(partida.jugador2.nombre)}
                  className="bg-red-600 hover:bg-red-500 font-bold py-3 rounded-lg transition-colors"
                >
                  {partida.jugador2.nombre}
                </button>
              </div>
            </div>
          )}

          {/* --- MESA DE JUEGO PRINCIPAL --- */}
          {partida && jugadorAsignado && miJugador && rival && (
            <div className="w-full flex flex-col items-center">
              {/* ZONA RIVAL */}
              <div className="w-full mb-4 flex flex-col items-center">
                <h3 className="text-neutral-400 font-medium mb-2 uppercase tracking-widest text-sm">
                  {rival.nombre} - Puntos:{" "}
                  <span className="text-white font-bold">{rival.puntos}</span>
                </h3>
                {/* Cartas jugadas por el rival */}
                <div className="flex justify-center gap-4 h-32 items-end">
                  {rival.cartasJugadas.map((carta, index) => (
                    <div
                      key={index}
                      className="w-20 h-28 bg-white text-slate-800 rounded-lg flex flex-col items-center justify-center shadow-xl border border-gray-300 font-bold text-lg rotate-[5deg] opacity-90"
                    >
                      <span>{carta.numero}</span>
                      <span className="text-sm uppercase">{carta.palo}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CENTRO DE LA MESA (Avisos de estado) */}
              <div className="w-full max-w-2xl h-24 bg-green-800 border-4 border-green-950 rounded-2xl flex flex-col items-center justify-center shadow-inner mb-4 relative overflow-hidden">
                {partida.estadoActual === "ESPERANDO_JUGADORES" && (
                  <h2 className="text-yellow-300 font-bold animate-pulse">
                    Esperando que se una el rival...
                  </h2>
                )}
                {partida.estadoActual === "ENTRE_MANOS" && (
                  <h2 className="text-white font-black text-xl animate-bounce">
                    ¡Mano Terminada! Repartiendo... ⏳
                  </h2>
                )}
                {partida.estadoActual === "TERMINADO" && (
                  <h1 className="text-yellow-400 font-black text-2xl">
                    🏆 ¡PARTIDO FINALIZADO! 🏆
                  </h1>
                )}
                {partida.ultimoGrito &&
                  partida.estadoActual !== "ENTRE_MANOS" && (
                    <h2 className="text-white font-bold text-lg bg-black/50 px-4 py-1 rounded-full uppercase tracking-wider">
                      🗣️ {partida.ultimoGrito}
                    </h2>
                  )}
              </div>

              {/* ZONA PROPIA */}
              <div className="w-full mt-4 flex flex-col items-center">
                {/* Cartas jugadas por mí */}
                <div className="flex justify-center gap-4 h-32 items-start mb-4">
                  {miJugador.cartasJugadas.map((carta, index) => (
                    <div
                      key={index}
                      className="w-20 h-28 bg-white text-slate-800 rounded-lg flex flex-col items-center justify-center shadow-xl border border-gray-300 font-bold text-lg rotate-[-5deg]"
                    >
                      <span>{carta.numero}</span>
                      <span className="text-sm uppercase">{carta.palo}</span>
                    </div>
                  ))}
                </div>

                <h3 className="text-neutral-400 font-medium mb-4 uppercase tracking-widest text-sm">
                  Vos ({miJugador.nombre}) - Puntos:{" "}
                  <span className="text-green-400 font-bold">
                    {miJugador.puntos}
                  </span>
                </h3>

                {/* Cartas en mano */}
                <div className="flex justify-center gap-4 mb-8">
                  {miJugador.mano.map((carta, index) => (
                    <div
                      key={index}
                      onClick={() => tirarCarta(index)}
                      className={`w-24 h-36 bg-white text-slate-900 border-4 rounded-xl flex flex-col items-center justify-center shadow-lg transition-all duration-200 
                        ${esMiTurno && partida.estadoActual === "ESPERANDO_CARTA" ? "cursor-pointer hover:-translate-y-4 border-transparent hover:border-green-500" : "opacity-70 cursor-not-allowed border-transparent"}`}
                    >
                      <span className="text-3xl font-black">
                        {carta.numero}
                      </span>
                      <span className="text-md font-bold uppercase">
                        {carta.palo}
                      </span>
                    </div>
                  ))}
                </div>

                {/* --- BOTONERA CONDICIONAL (TAILWIND) --- */}
                <div className="h-20 flex items-center justify-center">
                  {/* CASO A: Botones de turno normal */}
                  {partida.estadoActual === "ESPERANDO_CARTA" && esMiTurno && (
                    <div className="flex gap-3">
                      {partida.manoActual === 1 && !partida.envidoCerrado && (
                        <>
                          <button
                            onClick={() => gritar("envido")}
                            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold transition"
                          >
                            Envido
                          </button>
                          <button
                            onClick={() => gritar("real envido")}
                            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold transition"
                          >
                            Real Envido
                          </button>
                          <button
                            onClick={() => gritar("falta envido")}
                            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold transition"
                          >
                            Falta Envido
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => gritar("truco")}
                        className="bg-orange-600 hover:bg-orange-500 px-6 py-2 rounded font-bold transition"
                      >
                        Truco
                      </button>
                      <button
                        onClick={() => gritar("irse_al_mazo")}
                        className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded font-bold transition text-neutral-300 border border-neutral-600"
                      >
                        Al Mazo
                      </button>
                    </div>
                  )}

                  {/* CASO B: Botones de respuesta a ENVIDO */}
                  {partida.estadoActual === "ESPERANDO_RESPUESTA_ENVIDO" &&
                    meTocaResponder && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => responder("quiero")}
                          className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-bold transition text-lg shadow-lg shadow-green-900/50"
                        >
                          Quiero
                        </button>
                        <button
                          onClick={() => responder("no quiero")}
                          className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded font-bold transition text-lg shadow-lg shadow-red-900/50"
                        >
                          No Quiero
                        </button>

                        {/* Solución Error 1 y 3 (Envido infinito y botón faltante): 
                          Solo mostramos "Envido" si los puntos en juego son menos de 4 (para cortar el Envido-Envido infinito)
                          y si no cantaron Real ni Falta. */}
                        {partida.puntosEnJuegoEnvido < 4 &&
                          partida.ultimoGrito !== "REAL ENVIDO" &&
                          partida.ultimoGrito !== "FALTA ENVIDO" && (
                            <button
                              onClick={() => responder("envido")}
                              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold transition"
                            >
                              Envido
                            </button>
                          )}

                        {/* Mostramos "Real Envido" a menos que ya hayan cantado Real Envido o Falta Envido */}
                        {partida.ultimoGrito !== "REAL ENVIDO" &&
                          partida.ultimoGrito !== "FALTA ENVIDO" && (
                            <button
                              onClick={() => responder("real envido")}
                              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold transition"
                            >
                              Real Envido
                            </button>
                          )}

                        {/* "Falta Envido" siempre aparece a menos que ya hayan cantado Falta Envido */}
                        {partida.ultimoGrito !== "FALTA ENVIDO" && (
                          <button
                            onClick={() => responder("falta envido")}
                            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold transition"
                          >
                            Falta Envido
                          </button>
                        )}
                      </div>
                    )}

                  {/* CASO C: Botones de respuesta a TRUCO */}
                  {partida.estadoActual === "ESPERANDO_RESPUESTA_TRUCO" &&
                    meTocaResponder && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => responder("quiero")}
                          className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded font-bold transition text-lg shadow-lg shadow-green-900/50"
                        >
                          Quiero
                        </button>
                        <button
                          onClick={() => responder("no quiero")}
                          className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded font-bold transition text-lg shadow-lg shadow-red-900/50"
                        >
                          No Quiero
                        </button>

                        {/* Solución Error 2 y 3: Escalera obligatoria de Truco */}
                        {partida.ultimoGrito === "TRUCO" && (
                          <button
                            onClick={() => responder("retruco")}
                            className="bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded font-bold transition"
                          >
                            Quiero Retruco
                          </button>
                        )}
                        {partida.ultimoGrito === "RETRUCO" && (
                          <button
                            onClick={() => responder("vale cuatro")}
                            className="bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded font-bold transition"
                          >
                            Quiero Vale Cuatro
                          </button>
                        )}

                        {/* Si cantaron VALE CUATRO, no se dibuja ningún botón extra, cortando el bucle */}
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
