import { useCallback, useEffect, useState } from "react";
import { API_URL, pedirConSesion, leerError } from "../config";
import { pesos, formatearFecha, Hoja, Campo, BotonPrincipal, leerMonto } from "./plata";

async function pedir(url, opciones) {
  const res = await pedirConSesion(url, opciones);
  if (!res.ok) throw new Error(await leerError(res));
  return res.json();
}

const post = (url, cuerpo) =>
  pedir(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo ?? {}) });

const ESTADO = {
  ACREDITADA: { texto: "Acreditada sola", clase: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/25" },
  ASIGNADA: { texto: "Asignada", clase: "bg-sky-400/15 text-sky-300 ring-sky-400/25" },
  SIN_IDENTIFICAR: { texto: "Sin identificar", clase: "bg-amber-300/15 text-amber-200 ring-amber-300/25" },
  DEVUELTA: { texto: "Devuelta", clase: "bg-white/10 text-white/55 ring-white/15" },
};

function Chip({ estado }) {
  const e = ESTADO[estado] ?? ESTADO.DEVUELTA;
  return <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ring-1 ${e.clase}`}>{e.texto}</span>;
}

const formatoCuit = (c) => (c && c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c || "Sin CUIT");

// --------------------------------------------------------------- tarjeta sin identificar

function SinIdentificar({ t, onAsignar, onDevolver }) {
  return (
    <li className="rounded-3xl bg-white/[.05] ring-1 ring-amber-300/20 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight truncate">{t.nombreOriginante || "Sin nombre"}</p>
          <p className="text-xs text-white/55 mt-0.5 tabular-nums">CUIT {formatoCuit(t.cuitOriginante)}</p>
          <p className="text-[11px] text-white/40 mt-0.5">{formatearFecha(t.recibida)} · {t.proveedor}</p>
        </div>
        <p className="text-xl font-black tabular-nums">{pesos.format(t.monto)}</p>
      </div>
      {t.nota && <p className="mt-2.5 text-xs text-amber-100/80 bg-amber-300/10 rounded-xl px-3 py-2">{t.nota}</p>}
      <div className="grid grid-cols-2 gap-2.5 mt-3">
        <button onClick={() => onDevolver(t)} className="h-11 rounded-full font-semibold bg-white/10 hover:bg-white/15 active:scale-95 transition">
          Devolví la plata
        </button>
        <button onClick={() => onAsignar(t)} className="h-11 rounded-full font-semibold bg-emerald-500 hover:bg-emerald-400 active:scale-95 transition">
          Asignar
        </button>
      </div>
    </li>
  );
}

function Fila({ t }) {
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold leading-tight truncate">
            {t.usuario ? <span className="text-amber-200">{t.usuario}</span> : t.nombreOriginante || formatoCuit(t.cuitOriginante)}
          </p>
          <p className="text-[11px] text-white/40 mt-0.5 truncate">
            {formatearFecha(t.recibida)}
            {t.usuario && t.nombreOriginante ? ` · de ${t.nombreOriginante}` : ""}
            {t.resueltoPor && t.resueltoPor !== "automático" ? ` · por ${t.resueltoPor}` : ""}
          </p>
        </div>
        <p className="shrink-0 font-bold tabular-nums">{pesos.format(t.monto)}</p>
      </div>
      <div className="mt-1.5">
        <Chip estado={t.estado} />
      </div>
    </li>
  );
}

// --------------------------------------------------------------- hojas

function HojaAsignar({ t, onCerrar, onListo }) {
  const [q, setQ] = useState("");
  const [jugadores, setJugadores] = useState(null);
  const [elegido, setElegido] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      pedir(`${API_URL}/api/admin/usuarios?q=${encodeURIComponent(q.trim())}`)
        .then(setJugadores)
        .catch(() => setJugadores([]));
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const confirmar = async () => {
    setEnviando(true);
    setError("");
    try {
      await post(`${API_URL}/api/admin/transferencias/${t.id}/asignar`, { usuarioId: elegido.id });
      onListo(`Le acreditaste ${pesos.format(t.monto)} a ${elegido.username}`);
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  return (
    <Hoja titulo="Asignar transferencia" onCerrar={onCerrar}>
      {!elegido ? (
        <>
          <p className="text-sm text-white/60 mb-3">
            {pesos.format(t.monto)} de {t.nombreOriginante || formatoCuit(t.cuitOriginante)}. ¿A qué jugador se la acreditás?
          </p>
          <Campo etiqueta="Buscar jugador" placeholder="Nombre de usuario" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <ul className="mt-3 rounded-2xl bg-white/[.04] ring-1 ring-white/10 divide-y divide-white/10 max-h-72 overflow-y-auto">
            {jugadores === null ? (
              <li className="h-24 animate-pulse" />
            ) : jugadores.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-white/45">No hay jugadores con ese nombre.</li>
            ) : (
              jugadores.map((j) => (
                <li key={j.id}>
                  <button onClick={() => setElegido(j)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5">
                    <span className="font-semibold">{j.username}</span>
                    {j.bloqueado && <span className="text-[10px] font-bold uppercase text-rose-300">Suspendido</span>}
                  </button>
                </li>
              ))
            )}
          </ul>
        </>
      ) : (
        <>
          <p className="text-sm text-white/60 mb-4">
            Se le suman <b className="text-white">{pesos.format(t.monto)}</b> al saldo de{" "}
            <b className="text-amber-200">{elegido.username}</b> y le llega el aviso. No se puede deshacer.
          </p>
          {error && <p className="text-sm text-rose-300 mb-3">{error}</p>}
          <div className="space-y-2.5">
            <BotonPrincipal cargando={enviando} onClick={confirmar} className="bg-emerald-500 hover:bg-emerald-400">
              Sí, acreditar
            </BotonPrincipal>
            <button onClick={() => setElegido(null)} className="w-full h-12 rounded-full font-semibold bg-white/10 hover:bg-white/15">
              Elegir otro
            </button>
          </div>
        </>
      )}
    </Hoja>
  );
}

function HojaDevolver({ t, onCerrar, onListo }) {
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const confirmar = async () => {
    setEnviando(true);
    setError("");
    try {
      await post(`${API_URL}/api/admin/transferencias/${t.id}/devolver`, { nota });
      onListo("Marcada como devuelta");
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  return (
    <Hoja titulo="Marcar como devuelta" onCerrar={onCerrar}>
      <p className="text-sm text-white/60 mb-4">
        Primero devolvé los {pesos.format(t.monto)} desde el banco a {t.nombreOriginante || formatoCuit(t.cuitOriginante)}. Acá solo queda anotado; no se acredita a nadie.
      </p>
      <Campo etiqueta="Nota (opcional)" placeholder="Ej: devuelta el 27/11, op. 4455" maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} />
      {error && <p className="text-sm text-rose-300 mt-3">{error}</p>}
      <div className="space-y-2.5 mt-4">
        <BotonPrincipal cargando={enviando} onClick={confirmar} className="bg-white text-neutral-900 hover:bg-white/90">
          Ya la devolví
        </BotonPrincipal>
        <button onClick={onCerrar} className="w-full h-12 rounded-full font-semibold bg-white/10 hover:bg-white/15">
          Volver
        </button>
      </div>
    </Hoja>
  );
}

/** Cargar a mano lo que se ve en el extracto del banco (y sirve para probar sin banco conectado). */
function HojaCargar({ onCerrar, onListo }) {
  const [monto, setMonto] = useState("");
  const [cuit, setCuit] = useState("");
  const [nombre, setNombre] = useState("");
  const [operacion, setOperacion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const confirmar = async (e) => {
    e.preventDefault();
    const valor = leerMonto(monto);
    if (Number.isNaN(valor) || valor <= 0) return setError("Escribí un monto válido.");
    const soloNumeros = cuit.replace(/\D/g, "");
    if (soloNumeros.length !== 11 && soloNumeros.length !== 7 && soloNumeros.length !== 8)
      return setError("El CUIT/CUIL tiene 11 números (o poné el DNI).");
    setEnviando(true);
    setError("");
    try {
      const r = await post(`${API_URL}/api/admin/transferencias`, { monto: valor, cuit: soloNumeros, nombre, operacion });
      const t = r.transferencia;
      onListo(
        r.repetida
          ? "Esa operación ya estaba cargada: no se acreditó de nuevo"
          : t.estado === "ACREDITADA"
            ? `Acreditada sola a ${t.usuario}`
            : "No coincide con nadie: quedó en Sin identificar"
      );
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <Hoja titulo="Cargar transferencia" onCerrar={onCerrar}>
      <p className="text-sm text-white/60 mb-4">
        Copiá lo que ves en el banco. Si el CUIL coincide con el DNI de un jugador, se le acredita solo.
      </p>
      <form onSubmit={confirmar} className="space-y-3.5">
        <Campo etiqueta="Monto que entró" inputMode="decimal" placeholder="Ej: 5000" value={monto} onChange={(e) => setMonto(e.target.value)} required />
        <Campo etiqueta="CUIT / CUIL de quien mandó" inputMode="numeric" placeholder="20-30123456-7" value={cuit} onChange={(e) => setCuit(e.target.value)} required />
        <Campo etiqueta="Nombre (opcional)" placeholder="Como figura en el banco" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Campo
          etiqueta="Número de operación (recomendado)"
          ayuda="Con el número, la misma transferencia no se puede cargar dos veces."
          placeholder="Ej: 123456789"
          value={operacion}
          onChange={(e) => setOperacion(e.target.value)}
        />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <BotonPrincipal cargando={enviando} className="bg-emerald-500 hover:bg-emerald-400">
          Cargar
        </BotonPrincipal>
      </form>
    </Hoja>
  );
}

// --------------------------------------------------------------- pestaña

export default function AdminTransferencias({ onAviso, onCantidad }) {
  const [sinIdentificar, setSinIdentificar] = useState(null);
  const [recientes, setRecientes] = useState(null);
  const [hoja, setHoja] = useState(null); // { tipo: "asignar" | "devolver" | "cargar", t }

  const cargar = useCallback(() => {
    pedir(`${API_URL}/api/admin/transferencias?estado=SIN_IDENTIFICAR`)
      .then((l) => {
        setSinIdentificar(l);
        onCantidad?.(l.length);
      })
      .catch(() => setSinIdentificar([]));
    pedir(`${API_URL}/api/admin/transferencias?estado=TODAS`).then(setRecientes).catch(() => setRecientes([]));
  }, [onCantidad]);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 10000);
    return () => clearInterval(id);
  }, [cargar]);

  const listo = (texto) => {
    setHoja(null);
    onAviso?.(texto);
    cargar();
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => setHoja({ tipo: "cargar" })}
        className="w-full h-12 rounded-2xl font-semibold bg-white/[.07] ring-1 ring-white/10 hover:bg-white/10 flex items-center justify-center gap-2"
      >
        <span className="text-lg leading-none">+</span> Cargar transferencia del banco
      </button>

      <section>
        <h2 className="text-sm font-bold text-white/70 mb-2.5">Sin identificar</h2>
        {sinIdentificar === null ? (
          <div className="h-32 rounded-3xl bg-white/5 animate-pulse" />
        ) : sinIdentificar.length === 0 ? (
          <p className="rounded-3xl bg-white/[.04] ring-1 ring-white/10 text-center text-sm text-white/50 py-8">
            Todo en orden: cada transferencia encontró a su jugador.
          </p>
        ) : (
          <ul className="space-y-3">
            {sinIdentificar.map((t) => (
              <SinIdentificar key={t.id} t={t} onAsignar={(x) => setHoja({ tipo: "asignar", t: x })} onDevolver={(x) => setHoja({ tipo: "devolver", t: x })} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-bold text-white/70 mb-2.5">Últimas que entraron</h2>
        {recientes === null ? (
          <div className="h-32 rounded-3xl bg-white/5 animate-pulse" />
        ) : recientes.length === 0 ? (
          <p className="text-center text-sm text-white/50 py-8">Todavía no entró ninguna transferencia.</p>
        ) : (
          <ul className="rounded-3xl bg-white/[.04] ring-1 ring-white/10 px-4 divide-y divide-white/10">
            {recientes.map((t) => (
              <Fila key={t.id} t={t} />
            ))}
          </ul>
        )}
      </section>

      {hoja?.tipo === "asignar" && <HojaAsignar t={hoja.t} onCerrar={() => setHoja(null)} onListo={listo} />}
      {hoja?.tipo === "devolver" && <HojaDevolver t={hoja.t} onCerrar={() => setHoja(null)} onListo={listo} />}
      {hoja?.tipo === "cargar" && <HojaCargar onCerrar={() => setHoja(null)} onListo={listo} />}
    </div>
  );
}

