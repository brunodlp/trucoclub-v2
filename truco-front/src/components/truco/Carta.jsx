// Cartas del mazo español usando las imágenes de /public/cartas.
//
// Los archivos van del 1 al 40, ordenados por palo:
//   1-10 oros · 11-20 copas · 21-30 espadas · 31-40 bastos
// y dentro de cada palo: 1, 2, 3, 4, 5, 6, 7, sota (10), caballo (11), rey (12).
// El dorso es /cartas/dorso.png
// (Las imágenes originales eran pixel art de 73x113; están agrandadas x4 con el algoritmo xBR
//  para que se vean suaves sin cambiar el dibujo.)

const ORDEN_PALOS = ["ORO", "COPA", "ESPADA", "BASTO"];

/** Devuelve la ruta de la imagen para un número y palo. */
export function imagenCarta(numero, palo) {
  const base = ORDEN_PALOS.indexOf(palo) * 10;
  const posicion = numero <= 7 ? numero : numero - 2; // 10 → 8, 11 → 9, 12 → 10
  return `/cartas/${base + posicion}.png`;
}

// Los tamaños salen de variables CSS (index.css) que se adaptan a la pantalla
const TAMANIOS = {
  lg: "w-[var(--carta-lg)]",
  md: "w-[var(--carta-md)]",
  chica: "w-[var(--carta-chica)]",
  mesa: "w-[var(--carta-mesa)]",
  sm: "w-[34px] sm:w-[40px]",
};


export function Carta({ carta, tam = "lg", onClick, activa = false, apagada = false, className = "" }) {
  const { numero, palo } = carta;
  const clickeable = Boolean(onClick) && activa;

  return (
    <button
      type="button"
      onClick={clickeable ? onClick : undefined}
      disabled={!clickeable}
      aria-label={`${numero} de ${palo.toLowerCase()}`}
      title={`${numero} de ${palo.toLowerCase()}`}
      className={`${TAMANIOS[tam]} shrink-0 rounded-[9%/6%] transition-all duration-200 select-none
        ${clickeable ? "cursor-pointer hover:-translate-y-4 hover:rotate-0 hover:drop-shadow-[0_18px_22px_rgba(0,0,0,.55)] focus-visible:-translate-y-4 outline-none" : "cursor-default"}
        ${apagada ? "brightness-[.8] saturate-[.75]" : ""}
        drop-shadow-[0_6px_10px_rgba(0,0,0,.45)] ${className}`}
    >
      <img src={imagenCarta(numero, palo)} alt="" draggable={false} className="block w-full h-auto pointer-events-none" />
    </button>
  );
}

export function Dorso({ tam = "md", className = "" }) {
  return (
    <div className={`${TAMANIOS[tam]} shrink-0 drop-shadow-[0_4px_8px_rgba(0,0,0,.45)] ${className}`}>
      <img src="/cartas/dorso.png" alt="" draggable={false} className="block w-full h-auto" />
    </div>
  );
}

/** Lugar vacío en la mesa (invisible: solo guarda el espacio). */
export function HuecoCarta({ tam = "md" }) {
  return <div className={`${TAMANIOS[tam]} aspect-[73/113]`} />;
}
