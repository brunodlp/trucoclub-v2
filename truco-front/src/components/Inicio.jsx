import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, obtenerUsuario, pedirConSesion, guardarPerfil } from "../config";
import { Carta } from "./truco/Carta";
import Navegacion, { Encabezado } from "./Navegacion";
import { pesos, Aviso } from "./plata";
import { HojaDeposito, HojaRetiro, HojaNombre, HojaDni } from "./HojasPlata";

/** Foto de perfil circular. Si no tiene foto, muestra la inicial. */
function FotoPerfil({ nombre, url, size = 56 }) {
  return (
    <div
      className="shrink-0 rounded-full p-[2px] bg-gradient-to-br from-amber-200 via-amber-400 to-emerald-500"
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt={nombre} className="w-full h-full rounded-full object-cover bg-neutral-800" />
      ) : (
        <div className="w-full h-full rounded-full bg-neutral-900 grid place-items-center text-xl font-extrabold uppercase text-amber-200">
          {nombre?.[0] ?? "?"}
        </div>
      )}
    </div>
  );
}

export default function Inicio() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(() => obtenerUsuario());
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState(false);
  const [aviso, setAviso] = useState("");
  const [hoja, setHoja] = useState(null); // "deposito" | "retiro" | "nombre" | null
  const [datosPagos, setDatosPagos] = useState(null);

  const cargarPerfil = useCallback(() => {
    pedirConSesion(`${API_URL}/api/usuarios/yo`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p) => {
        setPerfil(p);
        setError(false);
        guardarPerfil(p.username, p.rol);
        setUsuario(p.username);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (!usuario) {
      navigate("/");
      return;
    }
    cargarPerfil();
  }, [usuario, navigate, cargarPerfil]);

  const faltaDni = perfil && !perfil.dni;
  const [despuesDelDni, setDespuesDelDni] = useState(null); // "deposito" | "retiro"

  const abrir = (cual) => {
    // Sin DNI no se puede depositar ni retirar: primero lo carga y después sigue con lo que eligió
    if (faltaDni) {
      setDespuesDelDni(cual);
      setHoja("dni");
      return;
    }
    setHoja(cual);
    if (!datosPagos) {
      pedirConSesion(`${API_URL}/api/movimientos/datos`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setDatosPagos)
        .catch(() => {});
    }
  };

  const abrirSinDni = (cual) => {
    setHoja(cual);
    if (!datosPagos) {
      pedirConSesion(`${API_URL}/api/movimientos/datos`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setDatosPagos)
        .catch(() => {});
    }
  };

  const listo = (texto) => {
    setHoja(null);
    cargarPerfil();
    setAviso(texto);
    setTimeout(() => setAviso(""), 2600);
  };

  if (!usuario) return null;

  return (
    <div className="min-h-[100dvh] bg-app text-white pb-28">
      <Encabezado />

      <main className="max-w-md mx-auto px-4">
        {/* Las tres cartas y el nombre */}
        <div className="flex justify-center -space-x-6 mt-4 mb-5">
          <Carta carta={{ numero: 1, palo: "ESPADA" }} tam="md" className="-rotate-12 translate-y-2" />
          <Carta carta={{ numero: 7, palo: "ORO" }} tam="md" className="z-10" />
          <Carta carta={{ numero: 1, palo: "BASTO" }} tam="md" className="rotate-12 translate-y-2" />
        </div>
        <h1 className="text-center text-5xl sm:text-6xl font-black tracking-[-0.04em] leading-none mb-8">
          Truco
          <span className="bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">Club</span>
        </h1>

        {/* Perfil y saldo */}
        <section className="rounded-3xl bg-gradient-to-br from-white/[.09] to-white/[.03] ring-1 ring-white/10 p-5 shadow-2xl shadow-black/40">
          <div className="flex items-center gap-3.5">
            <FotoPerfil nombre={usuario} url={perfil?.fotoUrl} />
            <div className="min-w-0">
              <button
                onClick={() => setHoja("nombre")}
                className="group flex items-center gap-1.5 max-w-full text-left"
                aria-label="Cambiar nombre de usuario"
              >
                <span className="text-lg font-bold truncate">{usuario}</span>
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-white/40 group-hover:text-white/80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16z" />
                  <path d="m13.5 6.5 4 4" />
                </svg>
              </button>
              <p className="text-xs text-white/50">Saldo disponible</p>
            </div>
          </div>

          <p className="mt-4 text-4xl font-black tracking-tight tabular-nums">
            {perfil ? pesos.format(perfil.saldo ?? 0) : error ? "—" : <span className="inline-block w-40 h-9 rounded-lg bg-white/10 animate-pulse align-middle" />}
          </p>
          {error && <p className="text-xs text-rose-300 mt-1">No se pudo cargar el saldo. ¿Está prendido el servidor?</p>}

          {faltaDni && (
            <button
              onClick={() => setHoja("dni")}
              className="mt-4 w-full flex items-center gap-3 rounded-2xl bg-amber-300/10 ring-1 ring-amber-300/30 px-3.5 py-3 text-left"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-amber-200" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <circle cx="9" cy="11" r="2" />
                <path d="M6.5 15.5c.6-1.2 1.5-1.8 2.5-1.8s1.9.6 2.5 1.8M14 10h4M14 13.5h3" />
              </svg>
              <span className="flex-1 text-sm">
                <b className="text-amber-100">Cargá tu DNI</b>
                <span className="block text-xs text-white/55">Lo necesitás para depositar y retirar.</span>
              </span>
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-white/40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          )}

          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              onClick={() => abrir("deposito")}
              className="h-12 rounded-full bg-emerald-500 active:bg-emerald-600 sm:hover:bg-emerald-400 font-semibold flex items-center justify-center gap-2 transition active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Depositar
            </button>
            <button
              onClick={() => abrir("retiro")}
              className="h-12 rounded-full bg-white/10 ring-1 ring-white/15 active:bg-white/20 sm:hover:bg-white/15 font-semibold flex items-center justify-center gap-2 transition active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0-6 6m6-6 6 6" /></svg>
              Retirar
            </button>
          </div>
        </section>
      </main>

      {hoja === "deposito" && <HojaDeposito datos={datosPagos} dni={perfil?.dni} onCerrar={() => setHoja(null)} onSaldo={cargarPerfil} />}
      {hoja === "retiro" && (
        <HojaRetiro datos={datosPagos} saldo={Number(perfil?.saldo ?? 0)} onCerrar={() => setHoja(null)} onListo={listo} />
      )}
      {hoja === "dni" && (
        <HojaDni
          onCerrar={() => {
            setHoja(null);
            setDespuesDelDni(null);
          }}
          onListo={() => {
            const siguiente = despuesDelDni;
            setDespuesDelDni(null);
            setPerfil((p) => (p ? { ...p, dni: "ok" } : p)); // ya tiene DNI (el perfil se recarga igual)
            cargarPerfil();
            if (siguiente) {
              setHoja(null);
              setTimeout(() => abrirSinDni(siguiente), 0);
            } else listo("DNI guardado. Ya podés depositar y retirar.");
          }}
        />
      )}
      {hoja === "nombre" && (
        <HojaNombre
          actual={usuario}
          onCerrar={() => setHoja(null)}
          onListo={(nuevo) => {
            setUsuario(nuevo);
            listo("Listo, ahora sos " + nuevo);
          }}
        />
      )}
      <Aviso texto={aviso} />

      <Navegacion />
    </div>
  );
}
