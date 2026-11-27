import { useCallback, useEffect, useState } from "react";
import { API_URL, pedirConSesion, leerError } from "../config";
import { pesos, formatearFecha, EstadoChip, IconoTipo, Hoja, BotonPrincipal, ENTRA, NOMBRE_TIPO } from "./plata";

const sinCentavos = (v) => pesos.format(v).replace(/,00$/, "");

async function pedir(url, opciones) {
  const res = await pedirConSesion(url, opciones);
  if (!res.ok) throw new Error(await leerError(res));
  return res.json();
}

function Insignias({ rol, bloqueado }) {
  return (
    <>
      {rol === "ADMIN" && (
        <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-amber-300/15 text-amber-200 ring-1 ring-amber-300/25">
          Admin
        </span>
      )}
      {bloqueado && (
        <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/25">
          Suspendido
        </span>
      )}
    </>
  );
}

const RESULTADO = {
  GANO: { texto: "Ganó", clase: "text-emerald-300" },
  PERDIO: { texto: "Perdió", clase: "text-rose-300" },
  JUGANDO: { texto: "Jugando", clase: "text-amber-200" },
  ESPERANDO: { texto: "Esperando", clase: "text-amber-200" },
  CANCELADA: { texto: "Cancelada", clase: "text-white/40" },
  ANULADA: { texto: "Anulada", clase: "text-white/40" },
};

// --------------------------------------------------------------- ficha

function Ficha({ id, onVolver, onCambio }) {
  const [f, setF] = useState(null);
  const [error, setError] = useState("");
  const [lista, setLista] = useState("movimientos");
  const [confirmar, setConfirmar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorAccion, setErrorAccion] = useState("");

  const cargar = useCallback(() => {
    pedir(`${API_URL}/api/admin/usuarios/${id}`)
      .then((d) => {
        setF(d);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarEstado = async () => {
    setEnviando(true);
    setErrorAccion("");
    try {
      await pedir(`${API_URL}/api/admin/usuarios/${id}/${f.bloqueado ? "desbloquear" : "bloquear"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: f.bloqueado ? undefined : JSON.stringify({ motivo }),
      });
      setConfirmar(false);
      setMotivo("");
      cargar();
      onCambio();
    } catch (e) {
      setErrorAccion(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const Volver = (
    <button onClick={onVolver} className="flex items-center gap-1 text-sm font-semibold text-white/60 hover:text-white mb-3">
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 6-6 6 6 6" />
      </svg>
      Jugadores
    </button>
  );

  if (!f) {
    return (
      <div>
        {Volver}
        {error ? <p className="text-sm text-rose-300">{error}</p> : <div className="h-64 rounded-3xl bg-white/5 animate-pulse" />}
      </div>
    );
  }

  const e = f.estadisticas;
  const datos = [
    ["Saldo", sinCentavos(f.saldo)],
    ["Partidos", `${e.ganadas} ganados de ${e.jugadas}`],
    ["Depositó", sinCentavos(e.depositado)],
    ["Retiró", sinCentavos(e.retirado)],
    ["Apostó", sinCentavos(e.apostado)],
    ["Cobró en premios", sinCentavos(e.cobrado)],
  ];

  return (
    <div>
      {Volver}

      <section className="rounded-3xl bg-white/[.05] ring-1 ring-white/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-extrabold tracking-tight truncate">{f.username}</h2>
              <Insignias rol={f.rol} bloqueado={f.bloqueado} />
            </div>
            <p className="text-xs text-white/45 mt-0.5 break-all">{f.email}</p>
            {f.registrado && <p className="text-[11px] text-white/35 mt-0.5">Se registró el {formatearFecha(f.registrado)}</p>}
          </div>
        </div>
        {f.bloqueado && f.motivoBloqueo && <p className="text-xs text-rose-300/90 mt-2">Motivo: {f.motivoBloqueo}</p>}

        <dl className="grid grid-cols-2 gap-2 mt-4">
          {datos.map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-black/20 px-3 py-2.5">
              <dt className="text-[11px] text-white/45">{k}</dt>
              <dd className="font-bold tabular-nums mt-0.5 text-sm">{v}</dd>
            </div>
          ))}
        </dl>

        {f.rol !== "ADMIN" && (
          <button
            onClick={() => {
              setErrorAccion("");
              setConfirmar(true);
            }}
            className={`mt-4 w-full h-11 rounded-full font-semibold transition active:scale-[.98] ${
              f.bloqueado ? "bg-white/10 hover:bg-white/15" : "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/25"
            }`}
          >
            {f.bloqueado ? "Reactivar cuenta" : "Suspender cuenta"}
          </button>
        )}
      </section>

      {/* Movimientos / Partidas */}
      <div className="flex gap-2 mt-5 mb-3">
        {[
          ["movimientos", `Movimientos (${f.movimientos.length})`],
          ["partidas", `Partidas (${f.partidas.length})`],
        ].map(([clave, texto]) => (
          <button
            key={clave}
            onClick={() => setLista(clave)}
            className={`h-8 px-3 rounded-full text-xs font-semibold transition ${
              lista === clave ? "bg-white text-neutral-900" : "bg-white/10 hover:bg-white/15"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {lista === "movimientos" &&
        (f.movimientos.length === 0 ? (
          <p className="text-sm text-white/45 text-center py-8">Sin movimientos.</p>
        ) : (
          <ul className="rounded-3xl bg-white/[.04] ring-1 ring-white/10 px-4 divide-y divide-white/10">
            {f.movimientos.map((m) => {
              const entra = ENTRA.has(m.tipo);
              const deMesa = !["DEPOSITO", "RETIRO"].includes(m.tipo);
              return (
                <li key={m.id} className="flex gap-3 py-3">
                  <IconoTipo tipo={m.tipo} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <p className="font-semibold text-sm">{NOMBRE_TIPO[m.tipo] ?? m.tipo}</p>
                      <p className={`shrink-0 text-sm font-bold tabular-nums ${entra ? "text-emerald-300" : ""}`}>
                        {entra ? "+" : "−"}
                        {pesos.format(m.monto)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {!deMesa && <EstadoChip estado={m.estado} />}
                      <span className="text-[11px] text-white/40 truncate">
                        {formatearFecha(m.creado)} · {m.detalle}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

      {lista === "partidas" &&
        (f.partidas.length === 0 ? (
          <p className="text-sm text-white/45 text-center py-8">Todavía no jugó.</p>
        ) : (
          <ul className="rounded-3xl bg-white/[.04] ring-1 ring-white/10 px-4 divide-y divide-white/10">
            {f.partidas.map((p) => {
              const r = RESULTADO[p.resultado] ?? RESULTADO.ANULADA;
              return (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">
                      {p.rival ? (
                        <>
                          vs <span className="text-white">{p.rival}</span>
                        </>
                      ) : (
                        <span className="text-white/50">Sin rival</span>
                      )}
                    </p>
                    <p className="text-[11px] text-white/40 tabular-nums">
                      {formatearFecha(p.fecha)} · {sinCentavos(p.monto)} a {p.puntos}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-bold ${r.clase}`}>{r.texto}</p>
                    {p.premio && <p className="text-[11px] text-emerald-300/80 tabular-nums">+{pesos.format(p.premio)}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

      {confirmar && (
        <Hoja titulo={f.bloqueado ? `¿Reactivar a ${f.username}?` : `¿Suspender a ${f.username}?`} onCerrar={() => setConfirmar(false)}>
          <p className="text-sm text-white/60 mb-4">
            {f.bloqueado
              ? "Va a poder volver a entrar y jugar. Le llega un aviso."
              : "No va a poder entrar ni jugar. Si tiene una mesa esperando rival, se cancela y se le devuelve la plata. Su saldo queda guardado."}
          </p>
          {!f.bloqueado && (
            <label className="block mb-4">
              <span className="block text-xs font-semibold text-white/60 mb-1.5">Motivo (lo ve al intentar entrar)</span>
              <input
                value={motivo}
                maxLength={200}
                onChange={(ev) => setMotivo(ev.target.value)}
                placeholder="Ej: uso de varias cuentas"
                className="w-full h-12 rounded-2xl bg-white/[.06] ring-1 ring-white/10 focus:ring-2 focus:ring-amber-300/70 outline-none px-4 placeholder:text-white/25"
              />
            </label>
          )}
          {errorAccion && <p className="text-sm text-rose-300 mb-3">{errorAccion}</p>}
          <div className="space-y-2.5">
            <BotonPrincipal
              cargando={enviando}
              onClick={cambiarEstado}
              className={f.bloqueado ? "bg-emerald-500 hover:bg-emerald-400" : "bg-rose-500 hover:bg-rose-400"}
            >
              {f.bloqueado ? "Sí, reactivar" : "Sí, suspender"}
            </BotonPrincipal>
            <button onClick={() => setConfirmar(false)} className="w-full h-12 rounded-full font-semibold bg-white/10 hover:bg-white/15">
              Volver
            </button>
          </div>
        </Hoja>
      )}
    </div>
  );
}

// --------------------------------------------------------------- búsqueda

export default function AdminJugadores() {
  const [texto, setTexto] = useState("");
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [elegido, setElegido] = useState(null);

  const buscar = useCallback((q) => {
    pedir(`${API_URL}/api/admin/usuarios?q=${encodeURIComponent(q)}`)
      .then((l) => {
        setLista(l);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, []);

  // busca 300 ms después de que dejás de escribir
  useEffect(() => {
    const id = setTimeout(() => buscar(texto), 300);
    return () => clearTimeout(id);
  }, [texto, buscar]);

  if (elegido) return <Ficha id={elegido} onVolver={() => setElegido(null)} onCambio={() => buscar(texto)} />;

  return (
    <div>
      <div className="relative mb-3">
        <svg viewBox="0 0 24 24" className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre de usuario"
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full h-12 rounded-2xl bg-white/[.06] ring-1 ring-white/10 focus:ring-2 focus:ring-amber-300/70 outline-none pl-11 pr-4 placeholder:text-white/30"
        />
      </div>
      {!texto && lista && <p className="text-[11px] text-white/40 mb-2 px-1">Últimos registrados</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {lista === null && !error ? (
        <div className="h-48 rounded-3xl bg-white/5 animate-pulse" />
      ) : lista?.length === 0 ? (
        <p className="text-sm text-white/45 text-center py-10">No hay jugadores con ese nombre.</p>
      ) : (
        <ul className="rounded-3xl bg-white/[.04] ring-1 ring-white/10 px-2 divide-y divide-white/10">
          {lista?.map((u) => (
            <li key={u.id}>
              <button onClick={() => setElegido(u.id)} className="w-full flex items-center gap-3 px-2 py-3 text-left hover:bg-white/[.03] rounded-xl">
                <span className="shrink-0 w-9 h-9 rounded-full bg-white/10 grid place-items-center text-sm font-bold uppercase text-amber-200">
                  {u.username[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold truncate">{u.username}</span>
                    <Insignias rol={u.rol} bloqueado={u.bloqueado} />
                  </div>
                  <p className="text-xs text-white/45 tabular-nums">{pesos.format(u.saldo)}</p>
                </div>
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-white/30" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
