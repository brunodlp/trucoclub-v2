import { API_URL, guardarPerfil, cerrarSesion } from "../config";
import { supabase } from "../supabase";
import Logo from "./Logo";

/** Lo que devuelve cargarPerfil cuando entró con Google y todavía no eligió nombre de usuario. */
export const PERFIL_INCOMPLETO = "PERFIL_INCOMPLETO";

/** Entrar o registrarse con Google: Supabase lo manda a Google y después vuelve a la página. */
export async function entrarConGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  return error ? traducirError(error) : null;
}

/** Botón "Continuar con Google" con una línea "o" arriba. */
export function BotonGoogle({ onError }) {
  const clic = async () => {
    const problema = await entrarConGoogle();
    if (problema) onError?.(problema);
  };
  return (
    <>
      <div className="flex items-center gap-3 my-5 text-xs text-white/35">
        <span className="h-px flex-1 bg-white/10" />o<span className="h-px flex-1 bg-white/10" />
      </div>
      <button
        type="button"
        onClick={clic}
        className="w-full h-12 rounded-full bg-white text-neutral-900 font-semibold flex items-center justify-center gap-2.5 hover:bg-white/90 active:scale-[.98] transition"
      >
        <span className="w-6 h-6 rounded-full ring-1 ring-neutral-300 grid place-items-center text-sm font-black text-neutral-700">G</span>
        Continuar con Google
      </button>
    </>
  );
}

/** Marco común de las pantallas de login y registro. */
export function PantallaAcceso({ titulo, subtitulo, children, pie }) {
  return (
    <div className="min-h-[100dvh] bg-app text-white flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo size={56} />
          <h1 className="mt-4 text-[2.5rem] leading-none font-black tracking-tight">
            Truco<span className="bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent">Club</span>
          </h1>
          <p className="mt-6 text-xl font-bold">{titulo}</p>
          {subtitulo && <p className="mt-1 text-sm text-white/50">{subtitulo}</p>}
        </div>
        {children}
        {pie && <p className="mt-6 text-sm text-center text-white/50">{pie}</p>}
      </div>
    </div>
  );
}

export function Mensaje({ texto, tipo = "error" }) {
  if (!texto) return null;
  const estilo =
    tipo === "error" ? "bg-rose-500/10 text-rose-200 ring-rose-400/25" : "bg-emerald-500/10 text-emerald-200 ring-emerald-400/25";
  return <p className={`rounded-2xl px-4 py-3 text-sm ring-1 ${estilo}`}>{texto}</p>;
}

/** Los errores de Supabase Auth vienen en inglés: los pasamos a algo entendible. */
export function traducirError(error) {
  const m = (error?.message ?? String(error ?? "")).toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Todavía no confirmaste tu email. Revisá tu correo (y el spam).";
  if (m.includes("user already registered")) return "Ya existe una cuenta con ese email.";
  if (m.includes("password should be at least")) return "La contraseña tiene que tener al menos 6 caracteres.";
  if (m.includes("nombre_ocupado")) return "Ese nombre ya lo usa otro jugador.";
  if (m.includes("nombre_invalido")) return "El nombre tiene que tener de 3 a 20 caracteres: letras, números, _ o punto.";
  if (m.includes("dni_ocupado")) return "Ya hay una cuenta con ese DNI.";
  if (m.includes("dni_invalido")) return "El DNI tiene que tener 7 u 8 números.";
  if (m.includes("database error saving new user")) return "No pudimos crear la cuenta. Probá con otro nombre de usuario.";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Esperá un momento y probá de nuevo.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "Ese email no es válido.";
  if (m.includes("failed to fetch") || m.includes("network")) return "No se pudo conectar. Revisá tu internet.";
  return "Algo salió mal. Probá de nuevo.";
}

/**
 * Con la sesión de Supabase ya abierta, le pide al backend el perfil de TrucoClub y lo guarda.
 * Devuelve null si salió bien, o el mensaje de error (ej: cuenta suspendida) y cierra la sesión.
 */
export async function cargarPerfil() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return "Iniciá sesión para continuar.";
  try {
    const res = await fetch(`${API_URL}/api/usuarios/yo`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const p = await res.json();
      guardarPerfil(p.username, p.rol);
      return null;
    }
    let mensaje = "No pudimos cargar tu perfil.";
    try {
      mensaje = (await res.json()).message || mensaje;
    } catch {
      /* sin cuerpo */
    }
    // Entró con Google y le falta elegir nombre: la sesión queda abierta para completarlo
    if (res.status === 409 && mensaje === PERFIL_INCOMPLETO) return PERFIL_INCOMPLETO;
    cerrarSesion();
    return mensaje;
  } catch {
    return "No se pudo conectar con el servidor.";
  }
}
