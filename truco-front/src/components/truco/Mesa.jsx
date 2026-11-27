import { pesos } from "../plata";
import { useEffect, useRef, useState } from "react";
import { Carta, Dorso } from "./Carta";
import Marcador from "./Marcador";

const SEGUNDOS_TURNO = 15;

const TONOS = {
  envido: "bg-sky-600 active:bg-sky-700 sm:hover:bg-sky-500",
  truco: "bg-orange-500 active:bg-orange-600 sm:hover:bg-orange-400",
  quiero: "bg-emerald-500 active:bg-emerald-600 sm:hover:bg-emerald-400",
  noquiero: "bg-rose-600 active:bg-rose-700 sm:hover:bg-rose-500",
  neutro: "bg-white/10 active:bg-white/20 sm:hover:bg-white/15 text-white/90 ring-1 ring-white/15",
};

function Boton({ children, onClick, tono = "neutro" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${TONOS[tono]} grow basis-[22%] sm:basis-auto sm:grow-0 min-w-[70px] h-11 sm:h-10 [@media(max-height:700px)]:h-10 px-2 sm:px-4 rounded-full
        text-white text-[13px] sm:text-sm font-semibold tracking-tight leading-tight shadow-lg shadow-black/30 transition active:scale-95`}
    >
      {children}
    </button>
  );
}

/** Cuenta regresiva local a partir de los milisegundos que manda el servidor. */
function useCuentaRegresiva(msRestantes, version) {
  const [fin, setFin] = useState(null);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    setFin(msRestantes >= 0 ? Date.now() + msRestantes : null);
    setAhora(Date.now());
  }, [msRestantes, version]);

  useEffect(() => {
    if (fin === null) return;
    const id = setInterval(() => setAhora(Date.now()), 200);
    return () => clearInterval(id);
  }, [fin]);

  if (fin === null) return null;
  // Si hay tiempo extra (ej. después del envido) se queda en 15 hasta que empieza a correr
  return Math.max(0, Math.min(SEGUNDOS_TURNO, Math.ceil((fin - ahora) / 1000)));
}

/** Avatar con un anillo que se va vaciando mientras le corre el tiempo. */
function Avatar({ nombre, segundos }) {
  const corre = segundos !== null && segundos !== undefined;
  const radio = 25;
  const largo = 2 * Math.PI * radio;
  const fraccion = corre ? segundos / SEGUNDOS_TURNO : 0;
  const urgente = corre && segundos <= 5;
  return (
    <div className="relative w-10 h-10 sm:w-12 sm:h-12 grid place-items-center shrink-0">
      {corre && (
        <svg viewBox="0 0 56 56" className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] -rotate-90">
          <circle cx="28" cy="28" r={radio} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="3.5" />
          <circle
            cx="28" cy="28" r={radio} fill="none"
            stroke={urgente ? "#fb7185" : "#fcd34d"} strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={largo} strokeDashoffset={largo * (1 - fraccion)}
            style={{ transition: "stroke-dashoffset .25s linear" }}
          />
        </svg>
      )}
      <div className="w-full h-full rounded-full grid place-items-center text-base sm:text-lg font-bold uppercase bg-gradient-to-br from-amber-200 to-amber-500 text-neutral-900">
        {nombre?.[0] ?? "?"}
      </div>
      {corre && (
        <span className={`absolute -bottom-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full grid place-items-center text-[10px] font-bold tabular-nums shadow
          ${urgente ? "bg-rose-500 text-white animate-pulse" : "bg-amber-300 text-neutral-900"}`}>
          {segundos}
        </span>
      )}
    </div>
  );
}


/**
 * Globo de los cantos (TRUCO, QUIERO...).
 * lado="abajo": sale debajo del jugador (rival) · lado="arriba": sale arriba, alineado a la izquierda (yo).
 */
function Globo({ texto, lado = "arriba" }) {
  const pos =
    lado === "abajo"
      ? "left-1/2 -translate-x-1/2 top-full mt-1.5 sm:left-full sm:translate-x-0 sm:top-1/2 sm:-translate-y-1/2 sm:mt-0 sm:ml-3"
      : "left-0 bottom-full mb-2";
  return (
    <div className={`absolute z-30 pointer-events-none ${pos}`}>
      <div className="anim-pop bg-white text-neutral-900 text-sm sm:text-base font-extrabold uppercase tracking-tight px-3.5 py-1.5 rounded-full shadow-xl whitespace-nowrap">
        {texto}
      </div>
    </div>
  );
}

/** Nube con los tantos del envido. */
function Nube({ texto, lado = "arriba" }) {
  const esNumero = /^\d+$/.test(texto);
  const pos =
    lado === "abajo"
      ? "left-1/2 -translate-x-1/2 top-full mt-1.5 sm:left-auto sm:right-full sm:translate-x-0 sm:top-1/2 sm:-translate-y-1/2 sm:mt-0 sm:mr-4"
      : "left-0 bottom-full mb-2";
  return (
    <div className={`absolute z-30 pointer-events-none ${pos}`}>
      <div className="anim-pop bg-white text-neutral-900 rounded-[1.4rem] px-4 py-1.5 shadow-xl whitespace-nowrap text-center">
        {esNumero ? (
          <span className="flex items-baseline gap-1">
            <span className="text-2xl font-black tabular-nums leading-none">{texto}</span>
            <span className="text-[10px] font-semibold uppercase text-neutral-500">de envido</span>
          </span>
        ) : (
          <span className="text-sm font-extrabold">Son buenas</span>
        )}
      </div>
    </div>
  );
}

/**
 * Una baza: la primera carta tirada va arriba y la segunda abajo, encimadas.
 * La carta que MATA queda por encima de la que pierde (en parda, la segunda queda encima),
 * así de un vistazo se ve quién ganó cada baza. Los dos jugadores ven la pila igual.
 */
function Baza({ suya, mia, abrioYo }) {
  const primera = abrioYo ? mia : suya;
  const segunda = abrioYo ? suya : mia;
  const mataLaSegunda = !primera || !segunda || segunda.jerarquiaTruco >= primera.jerarquiaTruco;
  const animacion = (c) => (c === mia ? "anim-tirar-abajo" : "anim-tirar-arriba");
  return (
    <div className="relative w-[var(--carta-mesa)] h-[calc(var(--carta-mesa)*2.62)]">
      {primera && (
        <div className={`absolute left-0 top-0 ${mataLaSegunda ? "z-0" : "z-20"}`}>
          <Carta key={primera.id} carta={primera} tam="mesa" className={animacion(primera)} />
        </div>
      )}
      {segunda && (
        <div className={`absolute left-0 top-[calc(var(--carta-mesa)*1.07)] ${mataLaSegunda ? "z-20" : "z-0"}`}>
          <Carta key={segunda.id} carta={segunda} tam="mesa" className={animacion(segunda)} />
        </div>
      )}
    </div>
  );
}

export default function Mesa({ vista, conectado, acciones, onSalir, onAbandonar }) {
  const { yo, rival } = vista;
  const [globo, setGlobo] = useState(null);
  const [nubes, setNubes] = useState([]); // tantos del envido que se están mostrando
  const [copiado, setCopiado] = useState(false);
  const [mostrarFin, setMostrarFin] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const nubesHasta = useRef(0); // hasta cuándo se están mostrando los tantos del envido
  // Los puntos del envido se anotan recién cuando terminan de cantarse los tantos
  const [puntosCongelados, setPuntosCongelados] = useState(null);
  const puntosAntes = useRef({ yo: yo.puntos, rival: rival.puntos });
  const seqVisto = useRef(vista.cantoSeq);
  const envidoVisto = useRef(vista.envidoSeq);
  const cantosRef = useRef(vista.envidoCantos);
  cantosRef.current = vista.envidoCantos;

  // Globo cada vez que alguien canta o responde
  useEffect(() => {
    if (vista.cantoSeq === seqVisto.current) return;
    seqVisto.current = vista.cantoSeq;
    if (!vista.cantoTexto) return;
    setGlobo({ texto: vista.cantoTexto, de: vista.cantoDe });
    const t = setTimeout(() => setGlobo(null), 1400);
    return () => clearTimeout(t);
  }, [vista.cantoSeq, vista.cantoTexto, vista.cantoDe]);

  // Nubes del envido: primero el mano, después el pie ("son buenas" si pierde)
  useEffect(() => {
    if (vista.envidoSeq === envidoVisto.current) return;
    envidoVisto.current = vista.envidoSeq;
    const cantos = cantosRef.current ?? [];
    const total = 1200 + cantos.length * 1400 + 1500;
    nubesHasta.current = Date.now() + total;
    setPuntosCongelados(puntosAntes.current); // seguimos mostrando los puntos de antes del envido
    const timers = cantos.map((c, i) => setTimeout(() => setNubes((prev) => [...prev, c]), 1200 + i * 1400));
    timers.push(setTimeout(() => setNubes([]), total));
    timers.push(setTimeout(() => setPuntosCongelados(null), 1200 + cantos.length * 1400 + 300));
    return () => timers.forEach(clearTimeout);
  }, [vista.envidoSeq]);

  // Guardamos los puntos de cada actualización (va después del efecto de las nubes a propósito)
  useEffect(() => {
    puntosAntes.current = { yo: yo.puntos, rival: rival.puntos };
  }, [yo.puntos, rival.puntos]);

  // El cartel de "partido terminado" aparece después de que se cantaron los tantos
  // (si se ganó con el envido) o un momento después de la última jugada.
  useEffect(() => {
    if (vista.estado !== "TERMINADO") {
      setMostrarFin(false);
      return;
    }
    // Si el rival abandonó, el cartel sale enseguida
    const espera = vista.abandonoDe ? 0 : Math.max(1200, nubesHasta.current - Date.now() + 300);
    const t = setTimeout(() => setMostrarFin(true), espera);
    return () => clearTimeout(t);
  }, [vista.estado, vista.abandonoDe]);

  const estado = vista.estado;
  const esperandoRival = estado === "ESPERANDO_JUGADORES";
  const esMiTurno = estado === "ESPERANDO_CARTA" && vista.turno === yo.nombre;
  const meTocaResponder = vista.debeResponder === yo.nombre;
  const bloqueadoPorCuatro = esMiTurno && vista.cartaEnMesaEsCuatro;
  const linkInvitacion = `${window.location.origin}/juego?mesa=${vista.mesaId}`;

  // Reloj: ¿a quién le corre el tiempo?
  const segundos = useCuentaRegresiva(vista.msRestantes, vista.versionAccion);
  const quienCorre =
    estado === "ESPERANDO_CARTA" ? vista.turno : estado.startsWith("ESPERANDO_RESPUESTA") ? vista.debeResponder : null;
  const segundosDe = (nombre) => (quienCorre === nombre ? segundos : null);
  const nubeDe = (nombre) => nubes.find((n) => n.jugador === nombre);

  // El canto (truco, envido...) queda a la vista hasta que el otro responda.
  // Las respuestas (quiero, no quiero, al mazo) se ven un ratito y desaparecen.
  const cantoPendiente =
    estado.startsWith("ESPERANDO_RESPUESTA") && vista.debeResponder
      ? { texto: vista.ultimoGrito, de: vista.debeResponder === yo.nombre ? rival.nombre : yo.nombre }
      : null;
  const globoDe = (nombre) => {
    if (globo && globo.de === nombre) return globo.texto;
    if (cantoPendiente && cantoPendiente.de === nombre) return cantoPendiente.texto;
    return null;
  };

  const copiarLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Truco Club", text: "¿Echamos un truco?", url: linkInvitacion });
        return;
      }
      await navigator.clipboard.writeText(linkInvitacion);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* el usuario canceló el menú de compartir */
    }
  };

  // ---------------------------------------------- botones según el momento
  const botones = [];
  if (esMiTurno && !bloqueadoPorCuatro) {
    if (vista.manoActual === 1 && !vista.envidoCerrado && vista.puntosEnJuegoTruco === 1) {
      botones.push(
        <Boton key="e" tono="envido" onClick={() => acciones.cantar("envido")}>Envido</Boton>,
        <Boton key="re" tono="envido" onClick={() => acciones.cantar("real envido")}>Real envido</Boton>,
        <Boton key="fe" tono="envido" onClick={() => acciones.cantar("falta envido")}>Falta envido</Boton>,
      );
    }
    const nivel = vista.puntosEnJuegoTruco;
    if (nivel === 1) {
      botones.push(<Boton key="t" tono="truco" onClick={() => acciones.cantar("truco")}>Truco</Boton>);
    } else if (vista.quienTieneElQuieroTruco === yo.nombre && nivel < 4) {
      const siguiente = nivel === 2 ? "retruco" : "vale cuatro";
      botones.push(
        <Boton key="t" tono="truco" onClick={() => acciones.cantar(siguiente)}>
          {nivel === 2 ? "Retruco" : "Vale cuatro"}
        </Boton>,
      );
    }
    botones.push(<Boton key="m" onClick={() => acciones.cantar("irse_al_mazo")}>Al mazo</Boton>);
  }

  if (meTocaResponder && estado === "ESPERANDO_RESPUESTA_ENVIDO") {
    const g = vista.ultimoGrito;
    botones.push(
      <Boton key="q" tono="quiero" onClick={() => acciones.responder("quiero")}>Quiero</Boton>,
      <Boton key="nq" tono="noquiero" onClick={() => acciones.responder("no quiero")}>No quiero</Boton>,
    );
    if (g === "ENVIDO" && vista.puntosEnJuegoEnvido === 2)
      botones.push(<Boton key="e" tono="envido" onClick={() => acciones.responder("envido")}>Envido</Boton>);
    if (g === "ENVIDO")
      botones.push(<Boton key="re" tono="envido" onClick={() => acciones.responder("real envido")}>Real envido</Boton>);
    if (g !== "FALTA ENVIDO")
      botones.push(<Boton key="fe" tono="envido" onClick={() => acciones.responder("falta envido")}>Falta envido</Boton>);
  }

  if (meTocaResponder && estado === "ESPERANDO_RESPUESTA_TRUCO") {
    const g = vista.ultimoGrito;
    botones.push(
      <Boton key="q" tono="quiero" onClick={() => acciones.responder("quiero")}>Quiero</Boton>,
      <Boton key="nq" tono="noquiero" onClick={() => acciones.responder("no quiero")}>No quiero</Boton>,
    );
    if (g === "TRUCO")
      botones.push(<Boton key="rt" tono="truco" onClick={() => acciones.responder("retruco")}>Retruco</Boton>);
    if (g === "RETRUCO")
      botones.push(<Boton key="v4" tono="truco" onClick={() => acciones.responder("vale cuatro")}>Vale cuatro</Boton>);
    // "El envido está primero": se puede contestar el truco con envido
    if (g === "TRUCO" && vista.manoActual === 1 && !vista.envidoCerrado && vista.puntosEnJuegoEnvido === 0 && !vista.trucoPendiente) {
      botones.push(
        <Boton key="e" tono="envido" onClick={() => acciones.responder("envido")}>Envido</Boton>,
        <Boton key="re" tono="envido" onClick={() => acciones.responder("real envido")}>Real envido</Boton>,
        <Boton key="fe" tono="envido" onClick={() => acciones.responder("falta envido")}>Falta envido</Boton>,
      );
    }
    botones.push(<Boton key="m" onClick={() => acciones.cantar("irse_al_mazo")}>Al mazo</Boton>);
  }

  const yoVisible = puntosCongelados ? { ...yo, puntos: puntosCongelados.yo } : yo;
  const rivalVisible = puntosCongelados ? { ...rival, puntos: puntosCongelados.rival } : rival;

  return (
    <div className="h-[100dvh] w-full bg-app text-white flex flex-col overflow-hidden select-none">
      {/* En el celular el paño ocupa toda la pantalla; en la compu queda como una mesa centrada */}
      <main className="flex-1 min-h-0 flex justify-center sm:p-3">
        <section className="relative w-full max-w-4xl h-full pano sm:rounded-[1.75rem] flex flex-col items-center pt-[max(env(safe-area-inset-top),8px)] pb-[max(env(safe-area-inset-bottom),8px)] px-2">
          {/* Arriba: salir · tanteador · a cuántos puntos */}
          <div className="w-full flex items-center justify-between gap-2 px-1 shrink-0">
            <button
              onClick={() => (estado === "TERMINADO" ? onSalir() : setConfirmarSalida(true))}
              title="Abandonar la partida"
              className="w-9 h-9 grid place-items-center rounded-full bg-black/25 text-white/70 active:bg-black/45 sm:hover:bg-black/35"
            >
              ✕
            </button>
            <Marcador yo={yoVisible} rival={rivalVisible} />
            <span title="Puntos del partido" className="min-w-9 h-9 px-2 grid place-items-center rounded-xl bg-white text-neutral-900 text-sm font-extrabold tabular-nums shadow">
              {vista.puntosPartido}
            </span>
          </div>
          {!conectado && (
            <span className="absolute top-14 left-1/2 -translate-x-1/2 z-30 text-xs bg-rose-500/90 rounded-full px-3 py-1">Reconectando...</span>
          )}

          {/* RIVAL */}
          <div className="relative flex items-center gap-2.5 mt-2 shrink-0">
            {globoDe(rival.nombre) && <Globo key={globoDe(rival.nombre)} texto={globoDe(rival.nombre)} lado="abajo" />}
            {nubeDe(rival.nombre) && <Nube texto={nubeDe(rival.nombre).texto} lado="abajo" />}
            <Avatar nombre={rival.nombre} segundos={segundosDe(rival.nombre)} />
            <span className="text-sm font-semibold text-white/90 max-w-[110px] truncate">{rival.nombre ?? "Rival"}</span>
            <div className="flex -space-x-3 ml-1">
              {Array.from({ length: rival.cartasEnMano }, (_, i) => (
                <Dorso key={i} tam="chica" className={["-rotate-6", "rotate-0", "rotate-6"][i]} />
              ))}
            </div>
          </div>

          {/* CENTRO: las cartas tiradas */}
          <div className="relative flex-1 min-h-0 w-full grid place-items-center">
            <div className="flex items-start justify-center gap-3.5 sm:gap-8">
              {[0, 1, 2].map((i) => (
                <Baza
                  key={i}
                  suya={rival.cartasJugadas[i]}
                  mia={yo.cartasJugadas[i]}
                  abrioYo={vista.abreBazas ? vista.abreBazas[i] === yo.nombre : false}
                />
              ))}
            </div>

            {/* Al terminar la ronda, el que ganó el envido muestra sus cartas */}
            {vista.envidoMostrado && (
              <div className="absolute inset-0 z-20 grid place-items-center">
                <div className="anim-pop flex flex-col items-center gap-2 bg-black/55 backdrop-blur-sm ring-1 ring-white/15 rounded-2xl px-4 py-3 shadow-2xl">
                  <span className="text-xs sm:text-sm text-white/80">
                    <b className="text-white">{vista.envidoMostrado.jugador === yo.nombre ? "Tus" : vista.envidoMostrado.jugador}</b>
                    {vista.envidoMostrado.jugador === yo.nombre ? " tantos" : ""} ·{" "}
                    <b className="text-amber-300 tabular-nums">{vista.envidoMostrado.tantos}</b>
                  </span>
                  <div className="flex gap-2">
                    {vista.envidoMostrado.cartas.map((c) => (
                      <Carta key={c.id} carta={c} tam="md" />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* MI MANO, con mi avatar al costado */}
          <div className="relative w-full flex justify-center items-end shrink-0 pt-2 pb-4">
            <div className="absolute left-1 sm:left-4 bottom-0 z-20 flex flex-col items-center gap-0.5">
              <div className="relative">
                {globoDe(yo.nombre) && <Globo key={globoDe(yo.nombre)} texto={globoDe(yo.nombre)} />}
                {nubeDe(yo.nombre) && <Nube texto={nubeDe(yo.nombre).texto} />}
                <Avatar nombre={yo.nombre} segundos={segundosDe(yo.nombre)} />
              </div>
              <span className="text-[11px] font-semibold text-white/80 max-w-[64px] truncate">{yo.nombre}</span>
            </div>
            <div className="flex justify-center -space-x-5 sm:-space-x-6 items-end">
              {yo.mano.map((carta, i) => (
                <Carta
                  key={carta.id}
                  carta={carta}
                  tam="lg"
                  activa={esMiTurno}
                  apagada={!esMiTurno && !esperandoRival}
                  onClick={() => acciones.jugar(i)}
                  className={`anim-repartir ${
                    yo.mano.length === 3
                      ? ["-rotate-[10deg] translate-y-3", "-translate-y-1", "rotate-[10deg] translate-y-3"][i]
                      : yo.mano.length === 2
                        ? ["-rotate-[6deg]", "rotate-[6deg]"][i]
                        : ""
                  }`}
                />
              ))}
            </div>
          </div>

          {/* BOTONES (adentro del paño, con lugar fijo para que nada salte) */}
          <div className="w-full max-w-2xl h-[92px] sm:h-12 mt-3 shrink-0 flex flex-wrap content-center items-center justify-center gap-2">
            {botones}
          </div>

          {/* SALA DE ESPERA (solo mientras falta el rival) */}
          {esperandoRival && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/60 sm:rounded-[1.75rem] backdrop-blur-sm p-4">
              <div className="w-full max-w-xs text-center anim-pop">
                <p className="text-white/60 text-xs font-medium uppercase tracking-[.2em]">Código de la mesa</p>
                <p className="font-mono text-5xl font-bold text-white tracking-[.25em] my-3 select-all">{vista.mesaId}</p>
                <p className="inline-block text-sm font-semibold bg-amber-400 text-neutral-900 rounded-full px-3 py-1 mb-5">
                  Partido a {vista.puntosPartido}
                </p>
                <button
                  onClick={copiarLink}
                  className="w-full h-12 bg-white text-neutral-900 font-semibold rounded-full active:scale-95 transition"
                >
                  {copiado ? "¡Link copiado!" : "Invitar rival"}
                </button>
                <p className="flex items-center justify-center gap-2 mt-5 text-white/60 text-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" /> Esperando rival
                </p>
                <button onClick={onAbandonar} className="mt-6 text-sm text-white/50 underline-offset-4 hover:underline">
                  Cerrar la mesa
                </button>
              </div>
            </div>
          )}

          {/* FIN DEL PARTIDO */}
          {estado === "TERMINADO" && mostrarFin && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/65 sm:rounded-[1.75rem] backdrop-blur-sm p-4">
              <div className="w-full max-w-xs text-center anim-pop">
                <div className="text-6xl mb-3">{vista.ganadorPartido === yo.nombre ? "🏆" : "🧉"}</div>
                {vista.abandonoDe && vista.abandonoDe !== yo.nombre && (
                  <p className="text-white/70 mb-1">{vista.abandonoDe} abandonó la partida</p>
                )}
                <p className="text-3xl font-extrabold tracking-tight">
                  {vista.ganadorPartido === yo.nombre ? "¡Ganaste!" : `Ganó ${vista.ganadorPartido}`}
                </p>
                <p className="text-white/60 mt-1 tabular-nums">
                  {yo.puntos} a {rival.puntos}
                </p>
                {Number(vista.monto) > 0 && (
                  <p
                    className={`mt-4 text-2xl font-black tabular-nums ${
                      vista.ganadorPartido === yo.nombre ? "text-emerald-300" : "text-white/50"
                    }`}
                  >
                    {vista.ganadorPartido === yo.nombre ? `+${pesos.format(vista.premio)}` : `−${pesos.format(vista.monto)}`}
                  </p>
                )}
                <button onClick={onSalir} className="mt-6 w-full h-12 bg-white text-neutral-900 font-semibold rounded-full active:scale-95 transition">
                  Volver a Mesas
                </button>
              </div>
            </div>
          )}
          {/* CONFIRMAR ABANDONO */}
          {confirmarSalida && estado !== "TERMINADO" && (
            <div className="absolute inset-0 z-50 grid place-items-center bg-black/60 sm:rounded-[1.75rem] backdrop-blur-sm p-6" onClick={() => setConfirmarSalida(false)}>
              <div className="w-full max-w-xs rounded-3xl bg-neutral-900 ring-1 ring-white/10 p-6 text-center shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
                <p className="text-xl font-extrabold tracking-tight">¿Seguro que querés abandonar?</p>
                <p className="text-sm text-white/60 mt-2">La partida se termina para los dos y la gana tu rival.</p>
                <div className="flex flex-col gap-2 mt-6">
                  <button
                    onClick={() => {
                      setConfirmarSalida(false);
                      onAbandonar();
                    }}
                    className="h-12 rounded-full bg-rose-600 active:bg-rose-700 sm:hover:bg-rose-500 font-semibold transition active:scale-95"
                  >
                    Sí, abandonar
                  </button>
                  <button
                    onClick={() => setConfirmarSalida(false)}
                    className="h-12 rounded-full bg-white text-neutral-900 font-semibold transition active:scale-95"
                  >
                    Seguir jugando
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
