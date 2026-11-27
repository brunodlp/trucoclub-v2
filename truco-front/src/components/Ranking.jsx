import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { obtenerUsuario } from "../config";
import Navegacion, { Encabezado } from "./Navegacion";

/** Ranking de jugadores: por ahora, solo el aviso de que se viene. */
export default function Ranking() {
  const navigate = useNavigate();
  const usuario = obtenerUsuario();

  useEffect(() => {
    if (!usuario) navigate("/");
  }, [usuario, navigate]);

  if (!usuario) return null;

  return (
    <div className="min-h-[100dvh] bg-app text-white pb-28">
      <Encabezado />
      <main className="max-w-md mx-auto px-4">
        <h1 className="text-3xl font-extrabold tracking-tight mt-4 mb-6">Ranking</h1>

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

          <span className="inline-block text-[11px] font-bold uppercase tracking-[.2em] text-amber-200 bg-amber-300/15 ring-1 ring-amber-300/25 rounded-full px-3 py-1">
            Muy pronto
          </span>
          <p className="text-2xl font-extrabold tracking-tight mt-4">Se viene el ranking</p>
          <p className="text-sm text-white/55 mt-2 max-w-[17rem] mx-auto">
            Los mejores truqueros del club, por partidas ganadas y premios cobrados.
          </p>
        </section>
      </main>
      <Navegacion />
    </div>
  );
}
