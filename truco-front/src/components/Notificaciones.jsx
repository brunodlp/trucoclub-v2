import { useCallback, useEffect, useState } from "react";
import { API_URL, pedirConSesion, obtenerToken } from "../config";
import { Hoja, formatearFecha } from "./plata";

const ESTILO = {
  OK: { clase: "bg-emerald-400/15 text-emerald-300", icono: <path d="m5 12.5 4.5 4.5L19 7.5" /> },
  ERROR: { clase: "bg-rose-400/15 text-rose-300", icono: <path d="M7 7l10 10M17 7 7 17" /> },
  PREMIO: {
    clase: "bg-amber-300/15 text-amber-200",
    icono: (
      <>
        <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
        <path d="M12 13v4M9 20h6" />
      </>
    ),
  },
  INFO: { clase: "bg-white/10 text-white/70", icono: <path d="M12 11v6m0-10v.5" /> },
};

/** Hace cuánto: "recién", "hace 5 min", "hace 2 h" o la fecha. */
function haceCuanto(iso) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  if (min < 24 * 60) return `hace ${Math.floor(min / 60)} h`;
  return formatearFecha(iso);
}

/**
 * Campana con el numerito de avisos sin leer. Al abrirla se marcan como leídos.
 * Se actualiza cada 30 segundos.
 */
export default function Campana() {
  const [datos, setDatos] = useState(null); // { notificaciones, sinLeer }
  const [abierta, setAbierta] = useState(false);

  const cargar = useCallback(() => {
    if (!obtenerToken()) return;
    pedirConSesion(`${API_URL}/api/notificaciones`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setDatos(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 30000);
    return () => clearInterval(id);
  }, [cargar]);

  const abrir = () => {
    setAbierta(true);
    if (datos?.sinLeer > 0) {
      pedirConSesion(`${API_URL}/api/notificaciones/leer`, { method: "POST" }).catch(() => {});
    }
  };

  const cerrar = () => {
    setAbierta(false);
    // al cerrar ya quedan todas como leídas
    setDatos((d) => d && { sinLeer: 0, notificaciones: d.notificaciones.map((n) => ({ ...n, leida: true })) });
  };

  const sinLeer = datos?.sinLeer ?? 0;

  return (
    <>
      <button
        onClick={abrir}
        className="relative w-9 h-9 -mr-1 rounded-full grid place-items-center text-white/70 hover:text-white hover:bg-white/10 transition"
        aria-label={sinLeer ? `Notificaciones (${sinLeer} sin leer)` : "Notificaciones"}
      >
        <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 1.8 6 1.8 6H4.2S6 14 6 9.5" />
          <path d="M10 19a2.2 2.2 0 0 0 4 0" />
        </svg>
        {sinLeer > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center ring-2 ring-neutral-950 tabular-nums">
            {sinLeer > 9 ? "9+" : sinLeer}
          </span>
        )}
      </button>

      {abierta && (
        <Hoja titulo="Notificaciones" onCerrar={cerrar}>
          {!datos || datos.notificaciones.length === 0 ? (
            <p className="text-sm text-white/50 text-center py-10">No tenés notificaciones.</p>
          ) : (
            <ul className="divide-y divide-white/10 -mt-1 pb-2">
              {datos.notificaciones.map((n) => {
                const e = ESTILO[n.tipo] ?? ESTILO.INFO;
                return (
                  <li key={n.id} className="flex gap-3 py-3">
                    <span className={`shrink-0 w-9 h-9 rounded-full grid place-items-center ${e.clase}`}>
                      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        {e.icono}
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-snug ${n.leida ? "text-white/70" : "text-white font-semibold"}`}>{n.texto}</p>
                      <p className="text-[11px] text-white/40 mt-0.5">{haceCuanto(n.creada)}</p>
                    </div>
                    {!n.leida && <span className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-rose-500" aria-label="Sin leer" />}
                  </li>
                );
              })}
            </ul>
          )}
        </Hoja>
      )}
    </>
  );
}
