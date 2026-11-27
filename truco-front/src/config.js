import { supabase } from "./supabase";

// Dirección del backend.
// - En desarrollo (npm run dev) usa tu Spring Boot local.
// - En producción (Vercel) usa Render.
// - Si querés forzar otra, creá un archivo .env con VITE_API_URL=https://...
export const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV
    ? "http://localhost:8080"
    : "https://trucoclub-backend.onrender.com");

export const WS_URL = `${API_URL}/ws-truco`;

// ------------------------------------------------------------------ sesión
// El login lo hace Supabase Auth (ver supabase.js). Acá guardamos el nombre y el rol del perfil
// de TrucoClub para mostrarlos sin tener que pedirlos cada vez.


const CLAVE_USUARIO = "trucoUsuario";
const CLAVE_ROL = "trucoRol";
const CLAVE_AVISO = "trucoAviso";

/** Token de Supabase para mandarle al backend (supabase-js lo renueva solo si está por vencer). */
export async function obtenerToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Nombre del usuario logueado (se guarda después de pedir el perfil al backend). */
export const obtenerUsuario = () => localStorage.getItem(CLAVE_USUARIO);

export const guardarPerfil = (nombre, rol) => {
  localStorage.setItem(CLAVE_USUARIO, nombre);
  if (rol) guardarRol(rol);
};

/** Solo sirve para mostrar u ocultar el panel de admin: el servidor chequea el rol de verdad. */
export const esAdmin = () => localStorage.getItem(CLAVE_ROL) === "ADMIN";
export const guardarRol = (rol) => localStorage.setItem(CLAVE_ROL, rol ?? "JUGADOR");

/** Borra los datos guardados y cierra la sesión de Supabase. */
export const cerrarSesion = () => {
  localStorage.removeItem(CLAVE_USUARIO);
  localStorage.removeItem(CLAVE_ROL);
  localStorage.removeItem("trucoToken"); // del login viejo
  sessionStorage.removeItem("trucoMesa");
  supabase.auth.signOut().catch(() => {});
};
export const borrarUsuario = cerrarSesion;

/** Un mensaje para mostrar en el login (ej: "Tu cuenta está suspendida"). Se lee una sola vez. */
export const avisoParaLogin = (texto) => sessionStorage.setItem(CLAVE_AVISO, texto);
export const leerAvisoLogin = () => {
  const t = sessionStorage.getItem(CLAVE_AVISO);
  sessionStorage.removeItem(CLAVE_AVISO);
  return t;
};

// Si la sesión de Supabase se cierra (en otra pestaña, o venció del todo), olvidamos el perfil
supabase.auth.onAuthStateChange((evento) => {
  if (evento === "SIGNED_OUT") {
    localStorage.removeItem(CLAVE_USUARIO);
    localStorage.removeItem(CLAVE_ROL);
  }
});

/** Saca el mensaje de error que mandó el servidor ({message: "..."} o texto). */
export async function leerError(res, porDefecto = "Algo salió mal. Probá de nuevo.") {
  try {
    const texto = await res.text();
    try {
      return JSON.parse(texto).message || porDefecto;
    } catch {
      return texto || porDefecto;
    }
  } catch {
    return porDefecto;
  }
}

/**
 * fetch que manda el token de Supabase. Si el servidor dice que la sesión no es válida (401)
 * o que la cuenta está suspendida (403), cierra la sesión y vuelve al login.
 */
export async function pedirConSesion(url, opciones = {}) {
  const token = await obtenerToken();
  if (!token) return salirAlLogin("Iniciá sesión para continuar.");

  const res = await fetch(url, {
    ...opciones,
    headers: { ...(opciones.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return salirAlLogin(await leerError(res.clone(), "Tu sesión venció. Volvé a iniciar sesión."));
  if (res.status === 409) {
    const mensaje = await leerError(res.clone(), "");
    if (mensaje === "PERFIL_INCOMPLETO") {
      window.location.href = "/completar-perfil";
      throw new Error("Elegí tu nombre de usuario.");
    }
  }
  if (res.status === 403) {
    const mensaje = await leerError(res.clone(), "");
    if (mensaje.startsWith("Tu cuenta está suspendida")) return salirAlLogin(mensaje);
  }
  return res;
}

function salirAlLogin(mensaje) {
  cerrarSesion();
  avisoParaLogin(mensaje);
  window.location.href = "/";
  throw new Error(mensaje);
}
