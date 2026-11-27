import { useState } from "react";

// Piezas compartidas por Inicio, Movimientos y el panel de admin.

/** "30123456" -> "30.123.456" */
export const formatoDni = (dni) => (dni ? String(dni).replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "");

/** Deja solo los números del DNI (acepta "30.123.456"). */
export const limpiarDni = (texto) => String(texto ?? "").replace(/\D/g, "");

export const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });

const fechaCorta = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** "26 nov, 21:15". El servidor manda la hora de Argentina sin zona. */
export const formatearFecha = (iso) => (iso ? fechaCorta.format(new Date(iso)) : "");

/** Convierte lo que escribe el usuario ("1.500,50" o "1500.5") a número. */
export function leerMonto(texto) {
  const limpio = String(texto).trim().replace(/\s|\$/g, "");
  if (!limpio) return NaN;
  // Formato argentino: punto de miles y coma decimal
  let normal = limpio;
  if (limpio.includes(",")) normal = limpio.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) normal = limpio.replace(/\./g, ""); // "1.500" = mil quinientos
  return /^\d+(\.\d{1,2})?$/.test(normal) ? Number(normal) : NaN;
}

export const ESTADOS = {
  PENDIENTE: { texto: "Pendiente", clase: "bg-amber-300/15 text-amber-200 ring-amber-300/25" },
  APROBADO: { texto: "Aprobado", clase: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/25" },
  RECHAZADO: { texto: "Rechazado", clase: "bg-rose-400/15 text-rose-300 ring-rose-400/25" },
  CANCELADO: { texto: "Cancelado", clase: "bg-white/10 text-white/50 ring-white/15" },
};

export function EstadoChip({ estado }) {
  const e = ESTADOS[estado] ?? ESTADOS.CANCELADO;
  return <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ring-1 ${e.clase}`}>{e.texto}</span>;
}

/** Ícono redondo: flecha abajo verde (entra plata) o arriba (sale). */
/** Tipos de movimiento que suman plata al saldo. */
export const ENTRA = new Set(["DEPOSITO", "PREMIO", "DEVOLUCION"]);

export const NOMBRE_TIPO = {
  DEPOSITO: "Depósito",
  RETIRO: "Retiro",
  APUESTA: "Apuesta",
  PREMIO: "Premio",
  DEVOLUCION: "Devolución",
};

export function IconoTipo({ tipo }) {
  const deposito = ENTRA.has(tipo);
  return (
    <span
      className={`shrink-0 w-10 h-10 rounded-full grid place-items-center ${
        deposito ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/70"
      }`}
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {deposito ? <path d="M12 5v14m0 0-6-6m6 6 6-6" /> : <path d="M12 19V5m0 0-6 6m6-6 6 6" />}
      </svg>
    </span>
  );
}

/** Hoja que sube desde abajo (en compu queda como ventana centrada). */
export function Hoja({ titulo, onCerrar, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <button aria-label="Cerrar" onClick={onCerrar} className="anim-fundido absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="anim-subir relative w-full sm:max-w-md bg-neutral-900 ring-1 ring-white/10 rounded-t-3xl sm:rounded-3xl px-5 pt-3 pb-[max(env(safe-area-inset-bottom),20px)] max-h-[92dvh] overflow-y-auto">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold tracking-tight">{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="w-9 h-9 -mr-2 rounded-full grid place-items-center text-white/50 hover:text-white hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Campo({ etiqueta, ayuda, ...props }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-white/60 mb-1.5">{etiqueta}</span>
      <input
        {...props}
        className="w-full h-12 rounded-2xl bg-white/[.06] ring-1 ring-white/10 focus:ring-2 focus:ring-amber-300/70 outline-none px-4 text-base placeholder:text-white/25"
      />
      {ayuda && <span className="block text-[11px] text-white/40 mt-1.5">{ayuda}</span>}
    </label>
  );
}

/** Texto con botón para copiarlo (alias, CBU, número de operación). */
export function Copiable({ etiqueta, valor }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1400);
    } catch {
      /* el navegador no dejó copiar: igual se puede seleccionar a mano */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] text-white/45">{etiqueta}</p>
        <p className="font-semibold break-all select-all">{valor}</p>
      </div>
      <button onClick={copiar} className="shrink-0 h-8 px-3 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/15 active:scale-95 transition">
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

export function BotonPrincipal({ cargando, children, className = "", ...props }) {
  return (
    <button
      {...props}
      disabled={cargando || props.disabled}
      className={`w-full h-12 rounded-full font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:active:scale-100 ${className}`}
    >
      {cargando ? "Enviando…" : children}
    </button>
  );
}

/** Cartelito que aparece abajo unos segundos. */
export function Aviso({ texto }) {
  if (!texto) return null;
  return (
    <div className="fixed bottom-24 inset-x-0 flex justify-center z-[60] pointer-events-none px-4">
      <span className="anim-aparecer bg-white text-neutral-900 text-sm font-semibold rounded-full px-4 py-2 shadow-xl text-center">{texto}</span>
    </div>
  );
}
