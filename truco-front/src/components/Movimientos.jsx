import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, obtenerUsuario, pedirConSesion, leerError } from "../config";
import Navegacion, { Encabezado } from "./Navegacion";
import { pesos, formatearFecha, EstadoChip, IconoTipo, Hoja, BotonPrincipal, Aviso, ENTRA, NOMBRE_TIPO } from "./plata";

function Fila({ m, onCancelar }) {
  const entra = ENTRA.has(m.tipo);
  const deMesa = !["DEPOSITO", "RETIRO"].includes(m.tipo);
  const tachado = m.estado === "RECHAZADO" || m.estado === "CANCELADO";
  return (
    <li className="flex gap-3 py-3.5">
      <IconoTipo tipo={m.tipo} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-tight">{NOMBRE_TIPO[m.tipo] ?? m.tipo}</p>
            <p className="text-xs text-white/45 mt-0.5">{formatearFecha(m.creado)}</p>
          </div>
          <p className={`shrink-0 font-bold tabular-nums ${tachado ? "line-through text-white/35" : entra ? "text-emerald-300" : ""}`}>
            {entra ? "+" : "−"}
            {pesos.format(m.monto)}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          {!deMesa && <EstadoChip estado={m.estado} />}
          <span className="min-w-0 flex-1 truncate text-[11px] text-white/40">
            {deMesa ? m.detalle : m.tipo === "RETIRO" ? `a ${m.detalle}` : /^\w+$/.test(m.detalle ?? "") && /\d/.test(m.detalle) ? `op. ${m.detalle}` : m.detalle}
          </span>
          {m.estado === "PENDIENTE" && (
            <button onClick={() => onCancelar(m)} className="text-xs font-semibold text-white/50 hover:text-white">
              Cancelar
            </button>
          )}
        </div>
        {m.motivoRechazo && <p className="text-xs text-rose-300/90 mt-1.5">{m.motivoRechazo}</p>}
      </div>
    </li>
  );
}

export default function Movimientos() {
  const navigate = useNavigate();
  const usuario = obtenerUsuario();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(false);
  const [aCancelar, setACancelar] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    pedirConSesion(`${API_URL}/api/movimientos`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((l) => {
        setLista(l);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (!usuario) {
      navigate("/");
      return;
    }
    cargar();
    const id = setInterval(cargar, 15000); // para ver cuando el admin lo aprueba
    return () => clearInterval(id);
  }, [usuario, navigate, cargar]);

  const mostrarAviso = (t) => {
    setAviso(t);
    setTimeout(() => setAviso(""), 2400);
  };

  const cancelar = async () => {
    setCancelando(true);
    try {
      const res = await pedirConSesion(`${API_URL}/api/movimientos/${aCancelar.id}/cancelar`, { method: "POST" });
      mostrarAviso(res.ok ? "Pedido cancelado" : await leerError(res));
    } catch (e) {
      mostrarAviso(e.message);
    } finally {
      setCancelando(false);
      setACancelar(null);
      cargar();
    }
  };

  if (!usuario) return null;

  return (
    <div className="min-h-[100dvh] bg-app text-white pb-28">
      <Encabezado />
      <main className="max-w-md mx-auto px-4">
        <h1 className="text-3xl font-extrabold tracking-tight mt-4 mb-5">Movimientos</h1>

        {lista === null && !error && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {error && lista === null && <p className="text-sm text-rose-300">No se pudieron cargar los movimientos.</p>}

        {lista?.length === 0 && (
          <div className="rounded-3xl bg-white/5 ring-1 ring-white/10 p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-white/10 grid place-items-center text-white/60">
              <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 4v15m0 0-3.5-3.5M7 19l3.5-3.5M17 20V5m0 0-3.5 3.5M17 5l3.5 3.5" />
              </svg>
            </div>
            <p className="font-semibold">Todavía no hay movimientos</p>
            <p className="text-sm text-white/50 mt-1">Acá vas a ver tus depósitos, retiros y mesas.</p>
          </div>
        )}

        {lista?.length > 0 && (
          <ul className="rounded-3xl bg-white/[.04] ring-1 ring-white/10 px-4 divide-y divide-white/10">
            {lista.map((m) => (
              <Fila key={m.id} m={m} onCancelar={setACancelar} />
            ))}
          </ul>
        )}
      </main>

      {aCancelar && (
        <Hoja titulo="¿Cancelar el pedido?" onCerrar={() => setACancelar(null)}>
          <p className="text-sm text-white/60 mb-5">
            {aCancelar.tipo === "RETIRO"
              ? `Los ${pesos.format(aCancelar.monto)} vuelven a tu saldo.`
              : `Vamos a dejar de esperar tu depósito de ${pesos.format(aCancelar.monto)}.`}
          </p>
          <div className="space-y-2.5">
            <BotonPrincipal cargando={cancelando} onClick={cancelar} className="bg-rose-500 hover:bg-rose-400">
              Sí, cancelar
            </BotonPrincipal>
            <button onClick={() => setACancelar(null)} className="w-full h-12 rounded-full font-semibold bg-white/10 hover:bg-white/15">
              No, dejarlo
            </button>
          </div>
        </Hoja>
      )}

      <Aviso texto={aviso} />
      <Navegacion />
    </div>
  );
}
