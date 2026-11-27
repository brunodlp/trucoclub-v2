import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { API_URL, WS_URL, obtenerUsuario, obtenerToken, pedirConSesion, cerrarSesion, leerError } from "../config";
import Mesa from "./truco/Mesa";
import Navegacion, { Encabezado } from "./Navegacion";
import { pesos, Hoja, BotonPrincipal, Aviso } from "./plata";

const RAPIDOS = [1000, 5000, 10000, 50000, 100000];

async function pedir(url, opciones) {
  const res = await pedirConSesion(url, opciones);
  if (!res.ok) throw new Error(await leerError(res, `Error ${res.status}`));
  const texto = await res.text();
  return texto ? JSON.parse(texto) : null;
}

const mensajeDe = (e) => (e.message === "Failed to fetch" ? "No se pudo conectar con el servidor" : e.message);

// ==========================================================================
// Hoja para armar una mesa: monto y a cuántos puntos
// ==========================================================================
function HojaCrear({ montos, comision, saldo, onCerrar, onCreada }) {
  const [indice, setIndice] = useState(() => Math.max(0, montos.indexOf(1000)));
  const [puntos, setPuntos] = useState(30);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const monto = montos[indice];
  const premio = monto * 2 * (1 - comision / 100);
  const alcanza = saldo >= monto;

  const crear = async () => {
    setCargando(true);
    setError("");
    try {
      await pedir(`${API_URL}/api/truco/mesas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto, puntos }),
      });
      onCreada();
    } catch (e) {
      setError(mensajeDe(e));
      setCargando(false);
    }
  };

  const BotonPaso = ({ delta, children }) => (
    <button
      onClick={() => setIndice((i) => Math.min(montos.length - 1, Math.max(0, i + delta)))}
      disabled={(delta < 0 && indice === 0) || (delta > 0 && indice === montos.length - 1)}
      className="shrink-0 w-12 h-12 rounded-full bg-white/10 hover:bg-white/15 active:scale-90 disabled:opacity-30 grid place-items-center text-2xl font-light transition"
      aria-label={delta < 0 ? "Menos" : "Más"}
    >
      {children}
    </button>
  );

  return (
    <Hoja titulo="Nueva mesa" onCerrar={onCerrar}>
      <p className="text-xs font-semibold text-white/60 mb-2">¿Cuánto se juega cada uno?</p>
      <div className="flex items-center gap-3">
        <BotonPaso delta={-1}>−</BotonPaso>
        <p className="flex-1 text-center text-4xl font-black tracking-tight tabular-nums">{pesos.format(monto).replace(",00", "")}</p>
        <BotonPaso delta={1}>+</BotonPaso>
      </div>
      <input
        type="range"
        min={0}
        max={montos.length - 1}
        value={indice}
        onChange={(e) => setIndice(Number(e.target.value))}
        className="w-full mt-4 accent-amber-300"
        aria-label="Monto"
      />
      <div className="flex gap-2 mt-2 overflow-x-auto -mx-1 px-1 pb-1">
        {RAPIDOS.map((v) => (
          <button
            key={v}
            onClick={() => setIndice(montos.indexOf(v))}
            className={`shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition ${
              monto === v ? "bg-amber-300 text-neutral-900" : "bg-white/10 hover:bg-white/15"
            }`}
          >
            {v >= 1000 ? `${v / 1000}k` : v}
          </button>
        ))}
      </div>

      <p className="text-xs font-semibold text-white/60 mt-5 mb-2">¿A cuántos puntos?</p>
      <div className="grid grid-cols-2 p-1 rounded-full bg-white/[.06] ring-1 ring-white/10 text-sm font-bold">
        {[15, 30].map((p) => (
          <button
            key={p}
            onClick={() => setPuntos(p)}
            className={`h-10 rounded-full transition ${puntos === p ? "bg-white text-neutral-900" : "text-white/60"}`}
          >
            A {p}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-white/[.06] ring-1 ring-white/10 px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-white/60">Premio para el ganador</span>
        <span className="text-lg font-black text-emerald-300 tabular-nums">{pesos.format(premio)}</span>
      </div>

      {!alcanza && <p className="text-sm text-rose-300 mt-3">No te alcanza el saldo ({pesos.format(saldo)}).</p>}
      {error && <p className="text-sm text-rose-300 mt-3">{error}</p>}

      <BotonPrincipal
        cargando={cargando}
        disabled={!alcanza}
        onClick={crear}
        className="mt-4 bg-amber-300 text-neutral-900 hover:bg-amber-200"
      >
        Crear mesa
      </BotonPrincipal>
      <p className="text-[11px] text-center text-white/40 mt-2">
        Se descuenta de tu saldo ahora. Si cancelás antes de que entre alguien, te lo devolvemos.
      </p>
    </Hoja>
  );
}

// ==========================================================================
// Tarjetas de la sala
// ==========================================================================
function TarjetaMesa({ m, onJugar }) {
  return (
    <li className="rounded-3xl bg-white/[.05] ring-1 ring-white/10 p-4 flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-black tracking-tight tabular-nums">{pesos.format(m.monto).replace(",00", "")}</p>
        <p className="text-xs text-white/50 mt-0.5 truncate">
          A {m.puntos} · de <span className="text-white/80 font-semibold">{m.creador}</span>
        </p>
        <p className="text-xs text-emerald-300/90 mt-1 tabular-nums">Premio {pesos.format(m.premio)}</p>
      </div>
      <button
        onClick={() => onJugar(m)}
        className="shrink-0 h-11 px-6 rounded-full font-semibold bg-emerald-500 hover:bg-emerald-400 active:scale-95 transition"
      >
        Jugar
      </button>
    </li>
  );
}

function MiMesa({ m, onCancelar, cancelando }) {
  return (
    <div className="rounded-3xl p-4 bg-gradient-to-br from-amber-300/15 to-amber-300/[.04] ring-1 ring-amber-300/30 mb-5">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 shrink-0 rounded-full border-[3px] border-amber-300/25 border-t-amber-300 animate-spin" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-amber-200">Tu mesa · esperando rival</p>
          <p className="text-2xl font-black tracking-tight tabular-nums">
            {pesos.format(m.monto).replace(",00", "")} <span className="text-sm font-semibold text-white/50">a {m.puntos}</span>
          </p>
        </div>
        <button
          onClick={onCancelar}
          disabled={cancelando}
          className="shrink-0 h-10 px-4 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/15 disabled:opacity-50 active:scale-95 transition"
        >
          {cancelando ? "…" : "Cancelar"}
        </button>
      </div>
      <p className="text-[11px] text-white/45 mt-3">
        Cuando alguien entre, arranca la partida. Si te gusta otra mesa, podés entrar: la tuya se cancela sola.
      </p>
    </div>
  );
}

// ==========================================================================
// Pantalla de Mesas + partida
// ==========================================================================
export default function Juego() {
  const navigate = useNavigate();
  // Se lee una sola vez: si en otra pestaña entra otra cuenta, esta pestaña sigue siendo la misma persona
  const [usuario] = useState(() => obtenerUsuario());

  const [sala, setSala] = useState(null); // { mesas, esperando, jugando, saldo }
  const [opciones, setOpciones] = useState(null); // { montos, comision }
  const [errorSala, setErrorSala] = useState("");
  const [creando, setCreando] = useState(false);
  const [aJugar, setAJugar] = useState(null);
  const [entrando, setEntrando] = useState(false);
  const [errorEntrar, setErrorEntrar] = useState("");
  const [cancelando, setCancelando] = useState(false);
  const [aviso, setAviso] = useState("");

  const [mesa, setMesa] = useState(null); // { mesaId }
  const [vista, setVista] = useState(null);
  const [conectado, setConectado] = useState(false);
  const clienteRef = useRef(null);

  useEffect(() => {
    if (!usuario) navigate("/");
  }, [usuario, navigate]);

  const mostrarAviso = (t) => {
    setAviso(t);
    setTimeout(() => setAviso(""), 2400);
  };

  // ==========================================
  // 1. SALA: se actualiza cada 2 segundos
  // ==========================================
  const cargarSala = useCallback(async () => {
    try {
      const s = await pedir(`${API_URL}/api/truco/mesas`);
      setSala(s);
      setErrorSala("");
      // Si entró alguien a mi mesa (o recargué la página jugando), voy a la partida
      if (s.jugando) setMesa((actual) => actual ?? { mesaId: s.jugando });
    } catch (e) {
      setErrorSala(mensajeDe(e));
    }
  }, []);

  useEffect(() => {
    if (!usuario || mesa) return;
    cargarSala();
    const id = setInterval(cargarSala, 2000);
    return () => clearInterval(id);
  }, [usuario, mesa, cargarSala]);

  useEffect(() => {
    if (!usuario) return;
    pedir(`${API_URL}/api/truco/mesas/opciones`).then(setOpciones).catch(() => {});
  }, [usuario]);

  const miMesa = sala?.mesas.find((m) => m.mia);
  const otras = sala?.mesas.filter((m) => !m.mia) ?? [];
  const saldo = Number(sala?.saldo ?? 0);

  const cancelarMiMesa = async () => {
    if (!miMesa) return;
    setCancelando(true);
    try {
      await pedir(`${API_URL}/api/truco/mesas/${miMesa.mesaId}/cancelar`, { method: "POST" });
      mostrarAviso("Mesa cancelada. Te devolvimos la plata.");
    } catch (e) {
      mostrarAviso(mensajeDe(e));
    } finally {
      setCancelando(false);
      cargarSala();
    }
  };

  const entrar = async () => {
    setEntrando(true);
    setErrorEntrar("");
    try {
      const info = await pedir(`${API_URL}/api/truco/mesas/${aJugar.mesaId}/unirse`, { method: "POST" });
      setAJugar(null);
      setMesa({ mesaId: info.mesaId });
    } catch (e) {
      setErrorEntrar(mensajeDe(e));
      cargarSala();
    } finally {
      setEntrando(false);
    }
  };

  // ==========================================
  // 2. PARTIDA EN TIEMPO REAL
  // ==========================================
  const terminado = vista?.estado === "TERMINADO";

  useEffect(() => {
    if (!mesa) return;
    let activo = true;

    const traerEstado = () =>
      pedir(`${API_URL}/api/truco/mesas/${mesa.mesaId}`)
        .then((v) => activo && setVista(v))
        .catch(() => {});

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      // El token de Supabase va en el CONNECT: el servidor sabe quién sos y no te deja jugar como otro.
      // Se pide de nuevo en cada reconexión, así siempre va uno vigente.
      beforeConnect: async () => {
        client.connectHeaders = { Authorization: `Bearer ${await obtenerToken()}` };
      },
      reconnectDelay: 3000,
      onConnect: () => {
        setConectado(true);
        client.subscribe(`/user/queue/partida`, (msg) => {
          const v = JSON.parse(msg.body);
          if (v.mesaId === mesa.mesaId) setVista(v);
        });
        traerEstado();
      },
      onWebSocketClose: () => setConectado(false),
      onStompError: (frame) => {
        if ((frame.headers?.message ?? "").toLowerCase().includes("sesi")) {
          client.deactivate();
          cerrarSesion();
          navigate("/");
        }
      },
    });
    client.activate();
    clienteRef.current = client;

    return () => {
      activo = false;
      client.deactivate();
      clienteRef.current = null;
      setConectado(false);
    };
  }, [mesa, navigate]);

  // Resincroniza cada 5 segundos por si se perdió algún mensaje del WebSocket (hasta que termina)
  useEffect(() => {
    if (!mesa || terminado) return;
    let activo = true;
    const traer = () =>
      pedir(`${API_URL}/api/truco/mesas/${mesa.mesaId}`)
        .then((v) => activo && setVista(v))
        .catch(() => {});
    traer();
    const id = setInterval(traer, 5000);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [mesa, terminado]);

  const enviar = (destino, cuerpo) => {
    const c = clienteRef.current;
    if (c && c.connected) c.publish({ destination: destino, body: JSON.stringify(cuerpo) });
  };

  const acciones = {
    jugar: (indice) => enviar("/app/jugar", { mesaId: mesa.mesaId, jugador: usuario, cartaIndice: indice }),
    cantar: (accion) => enviar("/app/cantar", { mesaId: mesa.mesaId, nombreJugador: usuario, accion }),
    responder: (accion) => enviar("/app/responder", { mesaId: mesa.mesaId, nombreJugador: usuario, accion }),
  };

  const salirDeLaMesa = () => {
    setMesa(null);
    setVista(null);
    setSala(null);
  };

  // Abandonar: el servidor termina la partida para los dos y gana el otro
  const abandonarMesa = async () => {
    const actual = mesa;
    if (actual) {
      try {
        await pedirConSesion(`${API_URL}/api/truco/mesas/${actual.mesaId}/abandonar`, { method: "POST" });
      } catch {
        /* si falla, el reloj del servidor termina la partida igual */
      }
    }
    salirDeLaMesa();
  };

  // ==========================================
  // 3. PANTALLAS
  // ==========================================
  if (!usuario) return null;

  if (mesa && vista) {
    return <Mesa vista={vista} conectado={conectado} acciones={acciones} onSalir={salirDeLaMesa} onAbandonar={abandonarMesa} />;
  }

  if (mesa) {
    return (
      <div className="min-h-[100dvh] bg-app grid place-items-center text-white/80">
        <div className="w-10 h-10 rounded-full border-4 border-amber-300/30 border-t-amber-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-app text-white pb-28">
      <Encabezado />

      <main className="max-w-md mx-auto px-4">
        <div className="flex items-end justify-between mt-4 mb-5">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Mesas</h1>
            <p className="text-xs text-white/50 mt-0.5 tabular-nums">Saldo {sala ? pesos.format(saldo) : "…"}</p>
          </div>
          <button
            onClick={() => setCreando(true)}
            disabled={!opciones || !!miMesa}
            className="h-11 px-5 rounded-full font-semibold bg-amber-300 text-neutral-900 hover:bg-amber-200 disabled:opacity-40 active:scale-95 transition flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Crear mesa
          </button>
        </div>

        {miMesa && <MiMesa m={miMesa} onCancelar={cancelarMiMesa} cancelando={cancelando} />}

        {errorSala && !sala && <p className="text-sm text-rose-300">{errorSala}</p>}

        {!sala && !errorSala && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-3xl bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {sala && otras.length === 0 && (
          <div className="rounded-3xl bg-white/5 ring-1 ring-white/10 p-8 text-center">
            <p className="font-semibold">No hay mesas abiertas</p>
            <p className="text-sm text-white/50 mt-1">{miMesa ? "Esperá a que alguien entre a la tuya." : "Creá una y esperá a que alguien entre."}</p>
          </div>
        )}

        {otras.length > 0 && (
          <ul className="space-y-3">
            {otras.map((m) => (
              <TarjetaMesa
                key={m.mesaId}
                m={m}
                onJugar={(x) => {
                  setErrorEntrar("");
                  setAJugar(x);
                }}
              />
            ))}
          </ul>
        )}
      </main>

      {creando && opciones && (
        <HojaCrear
          montos={opciones.montos}
          comision={opciones.comision}
          saldo={saldo}
          onCerrar={() => setCreando(false)}
          onCreada={() => {
            setCreando(false);
            cargarSala();
          }}
        />
      )}

      {aJugar && (
        <Hoja titulo="¿Entrar a esta mesa?" onCerrar={() => setAJugar(null)}>
          <div className="rounded-2xl bg-white/[.06] ring-1 ring-white/10 px-4 divide-y divide-white/10 mb-4">
            {[
              ["Contra", aJugar.creador],
              ["A", `${aJugar.puntos} puntos`],
              ["Ponés", pesos.format(aJugar.monto)],
              ["Premio si ganás", pesos.format(aJugar.premio)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5 text-sm">
                <span className="text-white/50">{k}</span>
                <span className={`font-semibold tabular-nums ${k === "Premio si ganás" ? "text-emerald-300" : ""}`}>{v}</span>
              </div>
            ))}
          </div>
          {miMesa && (
            <p className="text-xs text-amber-200/90 mb-3">Tu mesa de {pesos.format(miMesa.monto)} se cancela y te devolvemos la plata.</p>
          )}
          {saldo + (miMesa ? Number(miMesa.monto) : 0) < Number(aJugar.monto) && (
            <p className="text-sm text-rose-300 mb-3">No te alcanza el saldo ({pesos.format(saldo)}).</p>
          )}
          {errorEntrar && <p className="text-sm text-rose-300 mb-3">{errorEntrar}</p>}
          <div className="space-y-2.5">
            <BotonPrincipal
              cargando={entrando}
              disabled={saldo + (miMesa ? Number(miMesa.monto) : 0) < Number(aJugar.monto)}
              onClick={entrar}
              className="bg-emerald-500 hover:bg-emerald-400"
            >
              Sí, jugar
            </BotonPrincipal>
            <button onClick={() => setAJugar(null)} className="w-full h-12 rounded-full font-semibold bg-white/10 hover:bg-white/15">
              Volver
            </button>
          </div>
        </Hoja>
      )}

      <Aviso texto={aviso} />
      <Navegacion />
    </div>
  );
}
