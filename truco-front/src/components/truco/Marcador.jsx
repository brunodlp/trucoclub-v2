// Tanteador mínimo: los dos nombres con sus puntos en una pastilla.

export default function Marcador({ yo, rival }) {
  return (
    <div className="flex items-center gap-2.5 rounded-full bg-black/30 px-3.5 py-1.5 text-sm">
      <span className="text-white/60 truncate max-w-[80px] sm:max-w-[140px]">{yo.nombre}</span>
      <span className="font-bold tabular-nums">{yo.puntos}</span>
      <span className="text-white/30">·</span>
      <span className="font-bold tabular-nums">{rival.puntos}</span>
      <span className="text-white/60 truncate max-w-[80px] sm:max-w-[140px]">{rival.nombre ?? "Rival"}</span>
    </div>
  );
}
