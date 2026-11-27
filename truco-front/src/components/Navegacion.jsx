import { NavLink, useNavigate } from "react-router-dom";
import { obtenerUsuario, cerrarSesion as salir, esAdmin } from "../config";
import { LogoConNombre } from "./Logo";
import Campana from "./Notificaciones";

// ------------------------------------------------------------------ íconos

const IconoInicio = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 10.5 12 3.8l8.5 6.7V20a1 1 0 0 1-1 1h-4.8v-6.2H9.3V21H4.5a1 1 0 0 1-1-1z" />
  </svg>
);

const IconoMesas = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.2" y="5.2" width="10" height="14" rx="1.8" transform="rotate(-10 8.2 12.2)" />
    <rect x="10.8" y="5" width="10" height="14" rx="1.8" transform="rotate(8 15.8 12)" />
  </svg>
);

const IconoMovimientos = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 4v15m0 0-3.5-3.5M7 19l3.5-3.5M17 20V5m0 0-3.5 3.5M17 5l3.5 3.5" />
  </svg>
);

const IconoRanking = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6H5.5v1.5A2.5 2.5 0 0 0 8 10M16 6h2.5v1.5A2.5 2.5 0 0 1 16 10" />
    <path d="M12 13v3.5M9 20.5h6M10 16.5h4l.5 4h-5z" />
  </svg>
);

const IconoAdmin = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3.5 5 6.2v5.3c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6.2z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
);

const SECCIONES = [
  { a: "/inicio", nombre: "Inicio", Icono: IconoInicio },
  { a: "/juego", nombre: "Mesas", Icono: IconoMesas },
  { a: "/premios", nombre: "Premios", Icono: IconoRanking },
  { a: "/movimientos", nombre: "Movimientos", Icono: IconoMovimientos },
];

/** Barra de navegación fija abajo. Los admins ven además la sección Admin. */
export default function Navegacion() {
  const secciones = esAdmin() ? [...SECCIONES, { a: "/admin", nombre: "Admin", Icono: IconoAdmin }] : SECCIONES;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-neutral-950/90 backdrop-blur-md border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
      <div className={`max-w-md mx-auto grid ${secciones.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {secciones.map(({ a, nombre, Icono }) => (
          <NavLink
            key={a}
            to={a}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-semibold transition ${
                isActive ? "text-amber-300" : "text-white/50 hover:text-white/80"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`grid place-items-center w-12 h-7 rounded-full transition ${isActive ? "bg-amber-300/15" : ""}`}>
                  <Icono />
                </span>
                {nombre}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Encabezado de las pantallas de afuera del juego: logo, saludo, notificaciones y cerrar sesión. */
export function Encabezado() {
  const navigate = useNavigate();
  const usuario = obtenerUsuario();
  const cerrarSesion = () => {
    salir();
    navigate("/");
  };
  return (
    <header className="flex items-center justify-between px-4 sm:px-6 pt-[max(env(safe-area-inset-top),16px)] pb-3">
      <LogoConNombre />
      <div className="flex items-center gap-3 text-sm">
        <span className="text-white/60 hidden min-[440px]:inline">
          Hola, <b className="text-white">{usuario}</b>
        </span>
        <button onClick={cerrarSesion} className="text-white/50 hover:text-white">
          Cerrar sesión
        </button>
        <Campana />
      </div>
    </header>
  );
}
