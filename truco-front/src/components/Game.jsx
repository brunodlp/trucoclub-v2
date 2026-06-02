import { useState, useEffect, useRef } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { useLocation } from "react-router-dom";

// ==========================================
// CALCULADORA DE ENVIDO (Frontend)
// ==========================================
const calcularEnvidoReact = (jugador) => {
  if (!jugador) return 0;
  const cartas = [...jugador.mano, ...jugador.cartasJugadas];
  const getValor = (num) => (num >= 10 ? 0 : num);

  let max = 0;
  for (let i = 0; i < cartas.length; i++) {
    for (let j = i + 1; j < cartas.length; j++) {
      let pts =
        cartas[i].palo === cartas[j].palo
          ? 20 + getValor(cartas[i].numero) + getValor(cartas[j].numero)
          : Math.max(getValor(cartas[i].numero), getValor(cartas[j].numero));
      if (pts > max) max = pts;
    }
  }

  if (max === 0 && cartas.length > 0) {
    max = Math.max(...cartas.map((c) => getValor(c.numero)));
  }
  return max;
};

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
  // AUTO-ASIGNADOR DE JUGADORES
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
          destination: "/app/unirse",
          body: JSON.stringify({
            mesaId: mesaId,
            nombreJugador: miNombreDeUsuario,
            accion: "unirse",
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
  // MEMORIA DE GLOBOS Y PELÍCULA DEL ENVIDO 🍿 (INMORTAL)
  // ==========================================
  const prevPartidaRef = useRef(null);
  const [globosActivos, setGlobosActivos] = useState({});
  const peliculaRef = useRef(0);

  useEffect(() => {
    if (partida && prevPartidaRef.current) {
      const prev = prevPartidaRef.current;

      // 1. ¿Jugaron carta? -> Limpiamos la mesa
      const cartasAntes =
        prev.jugador1.cartasJugadas.length + prev.jugador2.cartasJugadas.length;
      const cartasAhora =
        partida.jugador1.cartasJugadas.length +
        partida.jugador2.cartasJugadas.length;
      if (cartasAhora > cartasAntes) {
        peliculaRef.current = 0;
        setGlobosActivos({});
      }

      // 2. ¿Grito nuevo? -> Limpiamos
      if (
        partida.estadoActual === "ESPERANDO_RESPUESTA_TRUCO" ||
        partida.estadoActual === "ESPERANDO_RESPUESTA_ENVIDO"
      ) {
        peliculaRef.current = 0;
        setGlobosActivos({});
      }

      // 3. SECUENCIA DE RESPUESTA AL ENVIDO
      if (
        prev.estadoActual === "ESPERANDO_RESPUESTA_ENVIDO" &&
        partida.estadoActual === "ESPERANDO_CARTA"
      ) {
        const autorRespuesta = prev.quienDebeResponder?.nombre;
        const ptsGanadosJ1 = partida.jugador1.puntos - prev.jugador1.puntos;
        const ptsGanadosJ2 = partida.jugador2.puntos - prev.jugador2.puntos;
        const puntosEnJuego = prev.puntosEnJuegoEnvido;

        const fueQuiero =
          ptsGanadosJ1 === puntosEnJuego || ptsGanadosJ2 === puntosEnJuego;

        if (!fueQuiero) {
          setGlobosActivos({ [autorRespuesta]: "NO QUIERO" });
        } else {
          const elMano = partida.mano;
          const elPie =
            partida.mano.nombre === partida.jugador1.nombre
              ? partida.jugador2
              : partida.jugador1;

          const ptsMano = calcularEnvidoReact(elMano);
          const ptsPie = calcularEnvidoReact(elPie);
          const manoGana = ptsMano >= ptsPie;

          const reproducirPelicula = async () => {
            const id = Date.now();
            peliculaRef.current = id;

            // Escena 1: El ¡QUIERO!
            setGlobosActivos({ [autorRespuesta]: "¡QUIERO!" });
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // Escena 2: El MANO canta primero sus puntos (borra el quiero del otro)
            if (peliculaRef.current !== id) return;
            setGlobosActivos({ [elMano.nombre]: `Tengo ${ptsMano}` });
            await new Promise((resolve) => setTimeout(resolve, 2500));

            // Escena 3: El PIE responde inteligentemente y los dos globos quedan activos
            if (peliculaRef.current !== id) return;

            let respuestaPie = manoGana
              ? "Son buenas"
              : `${ptsPie} son mejores`;

            setGlobosActivos({
              [elMano.nombre]: `Tengo ${ptsMano}`,
              [elPie.nombre]: respuestaPie,
            });
          };

          reproducirPelicula();
        }
      }

      // 4. SECUENCIA DE RESPUESTA AL TRUCO
      else if (
        prev.estadoActual === "ESPERANDO_RESPUESTA_TRUCO" &&
        partida.estadoActual !== "ESPERANDO_RESPUESTA_TRUCO"
      ) {
        const autorRespuesta = prev.quienDebeResponder?.nombre;
        if (
          partida.estadoActual === "ENTRE_MANOS" ||
          partida.estadoActual === "TERMINADO"
        ) {
          setGlobosActivos({ [autorRespuesta]: "NO QUIERO" });
        } else {
          setGlobosActivos({ [autorRespuesta]: "¡QUIERO!" });
        }
      }

      // 5. ¿Arrancó mano nueva? -> Limpiamos
      if (
        prev.estadoActual === "ENTRE_MANOS" &&
        partida.estadoActual === "ESPERANDO_CARTA"
      ) {
        peliculaRef.current = 0;
        setGlobosActivos({});
      }
    }
    prevPartidaRef.current = partida;
  }, [partida]);

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

  // Variables individuales para cada globo
  let miGlobo = null;
  let globoRival = null;

  if (partida && jugadorAsignado) {
    const soyJ1 = partida.jugador1.nombre === jugadorAsignado;
    miJugador = soyJ1 ? partida.jugador1 : partida.jugador2;
    rival = soyJ1 ? partida.jugador2 : partida.jugador1;

    esMiTurno = partida.turnoActual?.nombre === jugadorAsignado;
    meTocaResponder = partida.quienDebeResponder?.nombre === jugadorAsignado;

    // ¿Hay globos activos en la memoria?
    if (Object.keys(globosActivos).length > 0) {
      miGlobo = globosActivos[miJugador.nombre];
      globoRival = globosActivos[rival.nombre];
    }
    // Si no hay memoria pero alguien gritó algo fijo (Truco/Envido)
    else if (
      partida.ultimoGrito &&
      (partida.estadoActual === "ESPERANDO_RESPUESTA_TRUCO" ||
        partida.estadoActual === "ESPERANDO_RESPUESTA_ENVIDO")
    ) {
      const autorGrito = meTocaResponder ? rival.nombre : miJugador.nombre;
      if (autorGrito === miJugador.nombre) {
        miGlobo = partida.ultimoGrito;
      } else {
        globoRival = partida.ultimoGrito;
      }
    }
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
                A 15
              </button>
              <button
                onClick={() => setPuntosMesa(30)}
                className={`px-6 py-2 rounded-lg font-bold transition-all ${puntosMesa === 30 ? "bg-orange-600 text-white shadow-lg shadow-orange-900/50 scale-105" : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"}`}
              >
                A 30
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
          {/* --- INDICADOR DE MESA Y PUNTOS --- */}
          <div className="bg-neutral-800 px-6 py-2 rounded-full mb-6 border border-neutral-700 flex items-center gap-4 shadow-lg">
            <span>
              Mesa ID:{" "}
              <span className="text-yellow-400 font-mono font-bold select-all">
                {mesaId}
              </span>
            </span>

            {/* Si ya cargó la partida, mostramos a cuánto se juega */}
            {partida && partida.puntosPartido && (
              <>
                <span className="text-neutral-500">|</span>
                <span className="text-green-400 font-bold uppercase tracking-wider text-sm">
                  A {partida.puntosPartido} Puntos
                </span>
              </>
            )}
          </div>

          {partida && jugadorAsignado && miJugador && rival && (
            <div className="w-full flex flex-col items-center">
              {/* ZONA RIVAL */}
              <div className="w-full mb-4 flex flex-col items-center">
                <div className="relative inline-block mb-2">
                  <h3 className="text-neutral-400 font-medium uppercase tracking-widest text-sm">
                    {rival.nombre} - Puntos:{" "}
                    <span className="text-white font-bold">{rival.puntos}</span>
                  </h3>

                  {/* --- GLOBO DE CHAT DEL RIVAL (Izquierda) --- */}
                  {globoRival && (
                    <div className="absolute top-1/2 right-full -translate-y-1/2 mr-4 w-max bg-white text-slate-900 px-4 py-2 rounded-2xl rounded-tr-none font-black shadow-xl animate-bounce z-10 border-2 border-slate-300">
                      🗣️ {globoRival}
                    </div>
                  )}
                </div>
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
                <div className="relative inline-block mb-4 mt-2">
                  <h3 className="text-neutral-400 font-medium uppercase tracking-widest text-sm">
                    Vos ({miJugador.nombre}) - Puntos:{" "}
                    <span className="text-green-400 font-bold">
                      {miJugador.puntos}
                    </span>
                  </h3>

                  {/* --- GLOBO DE CHAT TUYO (Derecha) --- */}
                  {miGlobo && (
                    <div className="absolute top-1/2 left-full -translate-y-1/2 ml-4 w-max bg-green-500 text-white px-4 py-2 rounded-2xl rounded-tl-none font-black shadow-xl animate-bounce z-10 border-2 border-green-400">
                      🗣️ {miGlobo}
                    </div>
                  )}
                </div>

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
