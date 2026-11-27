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

const CLAVE_USUARIO = "trucoUsuario";
const CLAVE_TOKEN = "trucoToken";
const CLAVE_ROL = "trucoRol";

export const obtenerToken = () => localStorage.getItem(CLAVE_TOKEN);

/** Nombre del usuario logueado (solo si tiene un token guardado). */
export const obtenerUsuario = () => (obtenerToken() ? localStorage.getItem(CLAVE_USUARIO) : null);

export const guardarSesion = (nombre, token, rol) => {
  localStorage.setItem(CLAVE_USUARIO, nombre);
  localStorage.setItem(CLAVE_TOKEN, token);
  if (rol) guardarRol(rol);
};

/** Solo sirve para mostrar u ocultar el panel de admin: el servidor chequea el rol de verdad. */
export const esAdmin = () => localStorage.getItem(CLAVE_ROL) === "ADMIN";
export const guardarRol = (rol) => localStorage.setItem(CLAVE_ROL, rol ?? "JUGADOR");

export const borrarUsuario = () => {
  localStorage.removeItem(CLAVE_USUARIO);
  localStorage.removeItem(CLAVE_TOKEN);
  localStorage.removeItem(CLAVE_ROL);
};

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
 * fetch que manda el token de sesión. Si el servidor dice que la sesión no es válida (401),
 * borra la sesión y vuelve a la pantalla de login.
 */
export async function pedirConSesion(url, opciones = {}) {
  const res = await fetch(url, {
    ...opciones,
    headers: { ...(opciones.headers ?? {}), Authorization: `Bearer ${obtenerToken()}` },
  });
  if (res.status === 401) {
    borrarUsuario();
    sessionStorage.removeItem("trucoMesa");
    window.location.href = "/";
    throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
  }
  return res;
}
