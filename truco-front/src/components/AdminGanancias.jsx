import { useEffect, useMemo, useState } from "react";
import { API_URL, pedirConSesion, leerError } from "../config";
import { pesos, formatearFecha } from "./plata";

// --------------------------------------------------------------- fechas

const aISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const deISO = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const diaCorto = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const diaLargo = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short" });

const hoy = () => new Date();
const menosDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const ATAJOS = [
  { texto: "Hoy", rango: () => [hoy(), hoy()] },
  { texto: "1 día", rango: () => [menosDias(1), menosDias(1)] }, // ayer completo
  { texto: "7 días", rango: () => [menosDias(6), hoy()] },
  { texto: "30 días", rango: () => [menosDias(29), hoy()] },
  { texto: "Este mes", rango: () => [new Date(hoy().getFullYear(), hoy().getMonth(), 1), hoy()] },
  {
    texto: "Mes pasado",
    rango: () => [new Date(hoy().getFullYear(), hoy().getMonth() - 1, 1), new Date(hoy().getFullYear(), hoy().getMonth(), 0)],
  },
];

const sinCentavos = (v) => pesos.format(v).replace(/,00$/, "");

// --------------------------------------------------------------- piezas

function Tile({ titulo, periodo }) {
  return (
    <div className="rounded-2xl bg-white/[.05] ring-1 ring-white/10 p-3.5">
      <p className="text-[11px] font-semibold text-white/50">{titulo}</p>
      <p className="text-xl font-black tracking-tight tabular-nums mt-1">{sinCentavos(periodo.comision)}</p>
      <p className="text-[11px] text-white/40 mt-0.5">
        {periodo.partidos} {periodo.partidos === 1 ? "partido" : "partidos"}
      </p>
    </div>
  );
}

/** Barras de comisión por día. Tocá o pasá el mouse por una barra para ver el detalle. */
function GraficoDias({ dias }) {
  const [activo, setActivo] = useState(null);
  const max = Math.max(...dias.map((d) => Number(d.comision)), 0);
  const conGap = dias.length <= 60;
  const sel = activo != null ? dias[activo] : null;

  return (
    <div>
      {/* lectura del día señalado (o ayuda) */}
      <div className="h-9 flex items-end justify-between text-xs mb-6">
        {sel ? (
          <>
            <span className="text-white/60 capitalize">{diaLargo.format(deISO(sel.fecha))}</span>
            <span className="tabular-nums">
              <b className="text-white">{pesos.format(sel.comision)}</b>
              <span className="text-white/45"> · {sel.partidos} {sel.partidos === 1 ? "partido" : "partidos"}</span>
            </span>
          </>
        ) : (
          <span className="text-white/35">Tocá una barra para ver el día</span>
        )}
      </div>

      <div className="relative h-36" onMouseLeave={() => setActivo(null)}>
        {/* línea del máximo y base, bien suaves */}
        {max > 0 && (
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-white/10">
            <span className="absolute right-0 -top-4 text-[10px] text-white/35 tabular-nums">{sinCentavos(max)}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 border-t border-white/15" />

        <div className={`absolute inset-0 flex items-end ${conGap ? "gap-[2px]" : ""}`}>
          {dias.map((d, i) => {
            const v = Number(d.comision);
            const alto = max > 0 ? (v / max) * 100 : 0;
            return (
              <button
                key={d.fecha}
                type="button"
                onMouseEnter={() => setActivo(i)}
                onClick={() => setActivo(i)}
                onFocus={() => setActivo(i)}
                aria-label={`${diaCorto.format(deISO(d.fecha))}: ${pesos.format(v)}`}
                className="relative flex-1 h-full flex items-end min-w-0 outline-none"
              >
                <span
                  className={`block w-full rounded-t-[4px] transition-colors ${
                    activo === i ? "bg-[#f59e0b]" : "bg-[#d97706]"
                  } ${activo != null && activo !== i ? "opacity-60" : ""}`}
                  style={{ height: v > 0 ? `max(${alto}%, 3px)` : 0 }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between text-[10px] text-white/40 mt-1.5 tabular-nums">
        <span>{diaCorto.format(deISO(dias[0].fecha))}</span>
        {dias.length > 2 && <span>{diaCorto.format(deISO(dias[Math.floor(dias.length / 2)].fecha))}</span>}
        <span>{diaCorto.format(deISO(dias[dias.length - 1].fecha))}</span>
      </div>
    </div>
  );
}

function Fila({ texto, valor, signo = "", fuerte = false, tenue = false }) {
  return (
    <div className={`flex justify-between py-2 text-sm ${fuerte ? "font-bold" : ""}`}>
      <span className={tenue ? "text-white/45" : "text-white/70"}>{texto}</span>
      <span className="tabular-nums">
        {signo}
        {pesos.format(valor)}
      </span>
    </div>
  );
}

function Caja({ c }) {
  const dif = Number(c.diferencia);
  const cuadra = Math.abs(dif) < 0.01;
  return (
    <section className="rounded-3xl bg-white/[.04] ring-1 ring-white/10 p-4">
      <h3 className="font-bold">Caja</h3>
      <p className="text-[11px] text-white/45 mt-0.5 mb-2">Para saber qué parte de la plata de tu cuenta es tuya.</p>

      <div className="divide-y divide-white/10">
        <div>
          <Fila texto="Depósitos aprobados" valor={c.depositos} tenue />
          <Fila texto="Retiros pagados" valor={c.retiros} signo="−" tenue />
          <Fila texto="Tiene que haber en tu cuenta" valor={c.enCuenta} fuerte />
        </div>
        <div>
          <Fila texto="Saldos de los jugadores" valor={c.saldosJugadores} tenue />
          <Fila texto="Apostado en mesas abiertas" valor={c.enMesas} signo="+" tenue />
          <Fila texto="Retiros sin pagar" valor={c.retirosPendientes} signo="+" tenue />
          <Fila texto="Es de los jugadores" valor={c.deJugadores} fuerte />
        </div>
        <div>
          <div className="flex justify-between py-2.5 font-bold">
            <span>Es tuyo (comisión)</span>
            <span className="tabular-nums text-emerald-300">{pesos.format(c.comisionTotal)}</span>
          </div>
        </div>
      </div>

      <div
        className={`mt-2 flex items-start gap-2 rounded-2xl px-3 py-2.5 text-xs ${
          cuadra ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-300/10 text-amber-100"
        }`}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 mt-px" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {cuadra ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <path d="M12 8v5m0 3.5v.5M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />}
        </svg>
        {cuadra ? (
          <span>Cuadra: la cuenta coincide con los saldos y la comisión.</span>
        ) : (
          <span>
            No cuadra por {pesos.format(Math.abs(dif))}. Pasa si se cargó saldo a mano en la base o hubo movimientos de antes de este
            sistema. Revisalo.
          </span>
        )}
      </div>
    </section>
  );
}

// --------------------------------------------------------------- pantalla

export default function AdminGanancias() {
  const [desde, setDesde] = useState(() => aISO(menosDias(29)));
  const [hasta, setHasta] = useState(() => aISO(hoy()));
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!desde || !hasta) return;
    let activo = true;
    setCargando(true);
    pedirConSesion(`${API_URL}/api/admin/ganancias?desde=${desde}&hasta=${hasta}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await leerError(r));
        return r.json();
      })
      .then((d) => {
        if (!activo) return;
        setDatos(d);
        setError("");
      })
      .catch((e) => activo && setError(e.message))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [desde, hasta]);

  const atajoActivo = useMemo(
    () => ATAJOS.findIndex((a) => {
      const [d, h] = a.rango();
      return aISO(d) === desde && aISO(h) === hasta;
    }),
    [desde, hasta],
  );

  if (!datos) {
    return error ? <p className="text-sm text-rose-300">{error}</p> : <div className="h-64 rounded-3xl bg-white/5 animate-pulse" />;
  }

  const r = datos.rango;

  return (
    <div className="space-y-4">
      {/* Resumen rápido */}
      <div className="grid grid-cols-2 gap-2.5">
        <Tile titulo="Hoy" periodo={datos.hoy} />
        <Tile titulo="Esta semana" periodo={datos.semana} />
        <Tile titulo="Este mes" periodo={datos.mes} />
        <Tile titulo="Total" periodo={datos.total} />
      </div>

      {/* Rango de fechas */}
      <section className="rounded-3xl bg-white/[.04] ring-1 ring-white/10 p-4">
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {ATAJOS.map((a, i) => (
            <button
              key={a.texto}
              onClick={() => {
                const [d, h] = a.rango();
                setDesde(aISO(d));
                setHasta(aISO(h));
              }}
              className={`shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition ${
                atajoActivo === i ? "bg-white text-neutral-900" : "bg-white/10 hover:bg-white/15"
              }`}
            >
              {a.texto}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          {[
            ["Desde", desde, setDesde, { max: hasta }],
            ["Hasta", hasta, setHasta, { min: desde, max: aISO(hoy()) }],
          ].map(([etiqueta, valor, set, limites]) => (
            <label key={etiqueta} className="block">
              <span className="block text-[11px] font-semibold text-white/50 mb-1">{etiqueta}</span>
              <input
                type="date"
                value={valor}
                {...limites}
                onChange={(e) => e.target.value && set(e.target.value)}
                className="w-full h-11 rounded-xl bg-white/[.06] ring-1 ring-white/10 focus:ring-2 focus:ring-amber-300/70 outline-none px-3 text-sm [color-scheme:dark]"
              />
            </label>
          ))}
        </div>
        {error && <p className="text-xs text-rose-300 mt-2">{error}</p>}

        <div className={`mt-4 transition-opacity ${cargando ? "opacity-50" : ""}`}>
          <p className="text-[11px] font-semibold text-white/50">Comisión en el rango</p>
          <p className="text-3xl font-black tracking-tight tabular-nums">{pesos.format(r.comision)}</p>
          <p className="text-xs text-white/45 mt-0.5 tabular-nums">
            {r.partidos} {r.partidos === 1 ? "partido" : "partidos"} · {sinCentavos(r.volumen)} apostados
          </p>
          {/* con 1 o 2 días el gráfico no aporta: alcanza con el total */}
          {r.porDia.length >= 3 && (
            <div className="mt-4">
              <GraficoDias dias={r.porDia} />
            </div>
          )}
        </div>
      </section>

      {/* Partidos del rango (la tabla del gráfico) */}
      <section className="rounded-3xl bg-white/[.04] ring-1 ring-white/10 px-4 pt-4 pb-1">
        <h3 className="font-bold">
          Partidos <span className="text-white/40 font-semibold">({r.partidos})</span>
        </h3>
        {r.partidosLista.length === 0 ? (
          <p className="text-sm text-white/45 py-6 text-center">No hubo partidos en estas fechas.</p>
        ) : (
          <ul className="divide-y divide-white/10 mt-1">
            {r.partidosLista.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {p.ganador === p.creador ? <b className="text-amber-200">{p.creador}</b> : p.creador}
                    <span className="text-white/40 font-normal"> vs </span>
                    {p.ganador === p.rival ? <b className="text-amber-200">{p.rival}</b> : p.rival}
                  </p>
                  <p className="text-[11px] text-white/40 tabular-nums">
                    {formatearFecha(p.fecha)} · mesa de {sinCentavos(p.monto)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-300">+{pesos.format(p.comision)}</span>
              </li>
            ))}
          </ul>
        )}
        {r.partidos > r.partidosLista.length && (
          <p className="text-[11px] text-white/40 text-center pb-3">Se muestran los últimos {r.partidosLista.length}.</p>
        )}
      </section>

      <Caja c={datos.caja} />
    </div>
  );
}
