import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { obtenerUsuario } from "../config";
import Navegacion, { Encabezado } from "./Navegacion";

function MuyPronto() {
  return (
    <span className="inline-block text-[11px] font-bold uppercase tracking-[.2em] text-amber-200 bg-amber-300/15 ring-1 ring-amber-300/25 rounded-full px-3 py-1">
      Muy pronto
    </span>
  );
}

/** Ranking de jugadores: por ahora, el aviso de que se viene. */
function Ranking() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-300/15 via-white/[.04] to-emerald-500/10 ring-1 ring-white/10 px-6 py-10 text-center">
      {/* Podio */}
      <div className="flex items-end justify-center gap-2 mb-7" aria-hidden="true">
        {[
          { lugar: 2, alto: "h-14", tono: "from-neutral-300 to-neutral-500" },
          { lugar: 1, alto: "h-20", tono: "from-amber-200 to-amber-500" },
          { lugar: 3, alto: "h-10", tono: "from-orange-300 to-orange-700" },
        ].map(({ lugar, alto, tono }) => (
          <div key={lugar} className="flex flex-col items-center gap-2">
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${tono} grid place-items-center text-sm font-black text-neutral-900 shadow-lg`}>
              {lugar}
            </div>
            <div className={`w-14 ${alto} rounded-t-xl bg-white/10 ring-1 ring-white/10`} />
          </div>
        ))}
      </div>

      <MuyPronto />
      <p className="text-2xl font-extrabold tracking-tight mt-4">Se viene el ranking</p>
      <p className="text-sm text-white/55 mt-2 max-w-[17rem] mx-auto">
        Los mejores truqueros del club, por partidas ganadas y premios cobrados.
      </p>
    </section>
  );
}

/** Objetivos: desafíos que dan plata. Por ahora se muestran de ejemplo. */
function Objetivos() {
  const ejemplos = [
    { titulo: "Jugá 10 partidos de $5.000 o más", premio: 2000, hecho: 6, total: 10 },
    { titulo: "Ganá 3 partidos seguidos", premio: 1500, hecho: 1, total: 3 },
  ];
  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-emerald-500/15 via-white/[.04] to-amber-300/10 ring-1 ring-white/10 px-6 py-8 text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-emerald-400/15 text-emerald-300 grid place-items-center" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8.5" />
            <circle cx="12" cy="12" r="4.5" />
            <circle cx="12" cy="12" r="0.8" fill="currentColor" />
          </svg>
        </div>
        <MuyPronto />
        <p className="text-2xl font-extrabold tracking-tight mt-4">Cumplí objetivos, ganá plata</p>
        <p className="text-sm text-white/55 mt-2 max-w-[18rem] mx-auto">
          Desafíos que te suman saldo cuando los completás jugando.
        </p>
      </section>

      {/* Cómo se van a ver (de ejemplo, apagados) */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35 mb-2 px-1">Así se van a ver</p>
        <ul className="space-y-2.5 opacity-60 select-none" aria-hidden="true">
          {ejemplos.map((o) => (
            <li key={o.titulo} className="rounded-2xl bg-white/[.05] ring-1 ring-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold leading-snug">{o.titulo}</p>
                <span className="shrink-0 text-sm font-black text-emerald-300 tabular-nums">
                  +${o.premio.toLocaleString("es-AR")}
                </span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(o.hecho / o.total) * 100}%` }} />
              </div>
              <p className="text-[11px] text-white/45 mt-1.5 tabular-nums">
                {o.hecho} de {o.total}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const SECCIONES = [
  { clave: "ranking", texto: "Ranking" },
  { clave: "objetivos", texto: "Objetivos" },
];

export default function Premios() {
  const navigate = useNavigate();
  const usuario = obtenerUsuario();
  const [seccion, setSeccion] = useState("ranking");

  useEffect(() => {
    if (!usuario) navigate("/");
  }, [usuario, navigate]);

  if (!usuario) return null;

  return (
    <div className="min-h-[100dvh] bg-app text-white pb-28">
      <Encabezado />
      <main className="max-w-md mx-auto px-4">
        <h1 className="text-3xl font-extrabold tracking-tight mt-4 mb-4">Premios</h1>

        <div className="grid grid-cols-2 p-1 rounded-full bg-white/[.06] ring-1 ring-white/10 mb-5 text-sm font-semibold">
          {SECCIONES.map(({ clave, texto }) => (
            <button
              key={clave}
              onClick={() => setSeccion(clave)}
              className={`h-10 rounded-full transition ${seccion === clave ? "bg-white text-neutral-900" : "text-white/60"}`}
            >
              {texto}
            </button>
          ))}
        </div>

        {seccion === "ranking" ? <Ranking /> : <Objetivos />}
      </main>
      <Navegacion />
    </div>
  );
}
