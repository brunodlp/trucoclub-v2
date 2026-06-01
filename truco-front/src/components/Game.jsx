import { useState, useEffect } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { useLocation } from "react-router-dom";

export default function Juego() {
  const [mesaId, setMesaId] = useState(null);
  const [inputMesaId, setInputMesaId] = useState("");
  const [partida, setPartida] = useState(null);
  const [stompClient, setStompClient] = useState(null);
  const [jugadorAsignado, setJugadorAsignado] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const location = useLocation();
  const miNombreDeUsuario = location.state?.usuarioLogueado || "Invitado";
  const [puntosMesa, setPuntosMesa] = useState(30);

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
        setIsConnected(true);
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
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [partida?.estadoActual, stompClient, mesaId]);

  // ==========================================
  // AUTO-ASIGNADOR DE JUGADORES (Corregido y Único)
  // ==========================================
  useEffect(() => {
    if (partida && !jugadorAsignado && stompClient && isConnected) {
      if (partida.jugador1.nombre === miNombreDeUsuario) {
        setJugadorAsignado(miNombreDeUsuario);
      } else if (partida.jugador2.nombre === miNombreDeUsuario) {
        setJugadorAsignado(miNombreDeUsuario);
      } else if (
        partida.jugador2.nombre === "Rival" ||
        partida.jugador2.nombre === "IA"
      ) {
        setJugadorAsignado(miNombreDeUsuario);

        stompClient.publish({
          destination: "/app/sentarse", // 👈 Ojo acá: debe coincidir con tu backend
          body: JSON.stringify({
            mesaId: mesaId,
            nombreJugador: miNombreDeUsuario,
            accion: "sentarse",
          }),
        });
      } else {
        alert("¡Mesa llena! Ya hay dos personas jugando acá.");
        setMesaId(null);
      }
    }
  }, [
    partida,
    jugadorAsignado,
    stompClient,
    isConnected,
    mesaId,
    miNombreDeUsuario,
  ]);

  // ==========================================
  // 3. FUNCIONES DE ACCIÓN (DISPARADORES)
  // ==========================================
  const crearMesa = async () => {
    try {
      const url = `https://trucoclub-backend.onrender.com/api/truco/nueva?j1=${miNombreDeUsuario}&j2=Rival&puntos=${puntosMesa}`;
      const res = await fetch(url, { method: "POST" });
      const id = await res.text();
      setMesaId(id);
      setJugadorAsignado(miNombreDeUsuario);
    } catch (err) {
      alert("Error: ¿Está el server de Java prendido?");
    }
  };

  const unirseMesa = () => {
    if (inputMesaId.trim() !== "") setMesaId(inputMesaId);
    else alert("Por favor, ingresá un ID de mesa válido.");
  };

  const tirarCarta = async (indice) => {
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
    if (stompClient && stompClient.connected) {
      stompClient.publish({
        destination: "/app/cantar",
        body: JSON.stringify({
          mesaId,
          nombreJugador: jugadorAsignado,
          accion,
        }),
      });
    }
  };

  const responder = (accion) => {
    if (stompClient && stompClient.connected) {
      stompClient.publish({
        destination: "/app/responder",
        body: JSON.stringify({
          mesaId,
          nombreJugador: jugadorAsignado,
          accion,
        }),
      });
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

      {!mesaId ? (
        <div className="max-w-md mx-auto space-y-8">
          <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-xl">
            <p className="mb-4 text-neutral-300 font-medium">
              Configuración de la mesa
            </p>

            <div className="flex justify-center gap-4 mb-6">
              <button
                onClick={() => setPuntosMesa(15)}
                className={`px-6 py-2 rounded-lg font-bold transition-all ${puntosMesa === 15 ? "bg-orange-600 text-white shadow-lg shadow-orange-900/50 scale-105" : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"}`}
              >
                A 15 (Malas)
              </button>
              <button
                onClick={() => setPuntosMesa(30)}
                className={`px-6 py-2 rounded-lg font-bold transition-all ${puntosMesa === 30 ? "bg-orange-600 text-white shadow-lg shadow-orange-900/50 scale-105" : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"}`}
              >
                A 30 (Buenas)
              </button>
            </div>

            <button
              onClick={crearMesa}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-colors text-lg"
            >
              Crear Nueva Mesa
            </button>
          </div>

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

          {partida && jugadorAsignado && miJugador && rival && (
            <div className="w-full flex flex-col items-center">
              {/* ZONA RIVAL */}
              <div className="w-full mb-4 flex flex-col items-center">
                <h3 className="text-neutral-400 font-medium mb-2 uppercase tracking-widest text-sm">
                  {rival.nombre} - Puntos:{" "}
                  <span className="text-white font-bold">{rival.puntos}</span>
                </h3>
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

              {/* CENTRO DE LA MESA */}
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

                {/* --- BOTONERA CONDICIONAL --- */}
                <div className="h-20 flex items-center justify-center">
                  {/* CASO A */}
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
                      {partida.puntosEnJuegoTruco === 1 && (
                        <button
                          onClick={() => gritar("truco")}
                          className="bg-orange-600 hover:bg-orange-500 px-6 py-2 rounded font-bold transition"
                        >
                          Truco
                        </button>
                      )}
                      {partida.puntosEnJuegoTruco === 2 &&
                        partida.quienTieneElQuieroTruco?.nombre ===
                          miJugador.nombre && (
                          <button
                            onClick={() => gritar("retruco")}
                            className="bg-orange-600 hover:bg-orange-500 px-6 py-2 rounded font-bold transition"
                          >
                            Retruco
                          </button>
                        )}
                      {partida.puntosEnJuegoTruco === 3 &&
                        partida.quienTieneElQuieroTruco?.nombre ===
                          miJugador.nombre && (
                          <button
                            onClick={() => gritar("vale cuatro")}
                            className="bg-orange-600 hover:bg-orange-500 px-6 py-2 rounded font-bold transition"
                          >
                            Vale Cuatro
                          </button>
                        )}
                      <button
                        onClick={() => gritar("irse_al_mazo")}
                        className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded font-bold transition text-neutral-300 border border-neutral-600"
                      >
                        Al Mazo
                      </button>
                    </div>
                  )}

                  {/* CASO B */}
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
                        {partida.ultimoGrito !== "REAL ENVIDO" &&
                          partida.ultimoGrito !== "FALTA ENVIDO" && (
                            <button
                              onClick={() => responder("real envido")}
                              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold transition"
                            >
                              Real Envido
                            </button>
                          )}
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

                  {/* CASO C */}
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
