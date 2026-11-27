import { useId } from "react";

/**
 * Logo de TrucoClub: dos cartas abiertas en abanico sobre un paño verde,
 * con una "T" dorada en la de adelante.
 */
export default function Logo({ size = 36, className = "" }) {
  const id = "lg" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-label="TrucoClub">
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#23845a" />
          <stop offset="1" stopColor="#0d3a25" />
        </linearGradient>
        <linearGradient id={`${id}o`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe9a3" />
          <stop offset="1" stopColor="#d99a1e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id}f) #1a6b45`} />
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="12.4" fill="none" stroke="#ffffff" strokeOpacity="0.12" />
      {/* carta de atrás */}
      <g transform="rotate(-15 20 25)">
        <rect x="10.5" y="11" width="18" height="26" rx="3.2" fill="#efe6cf" stroke={`url(#${id}o) #e0a526`} strokeWidth="1.2" />
      </g>
      {/* carta de adelante con la T */}
      <g transform="rotate(10 28 25)">
        <rect x="19" y="11.5" width="18.5" height="26.5" rx="3.2" fill="#fffdf6" stroke={`url(#${id}o) #e0a526`} strokeWidth="1.5" />
        <path d="M23.2 18.2 H33.3 V21.2 H29.7 V32 H26.8 V21.2 H23.2 Z" fill={`url(#${id}o) #e0a526`} stroke="#a8740a" strokeWidth="0.5" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Logo + nombre, para encabezados. */
export function LogoConNombre({ size = 30 }) {
  return (
    <span className="flex items-center gap-2">
      <Logo size={size} />
      <span className="text-base font-extrabold tracking-tight">
        Truco<span className="text-amber-300">Club</span>
      </span>
    </span>
  );
}
