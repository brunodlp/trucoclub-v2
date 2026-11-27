import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, cerrarSesion } from "../config";
import { supabase } from "../supabase";
import { Campo, BotonPrincipal } from "./plata";
import { PantallaAcceso, Mensaje, cargarPerfil } from "./Acceso";

const NOMBRE_VALIDO = /^[A-Za-z0-9_.]{3,20}$/;

/**
 * Después de entrar con Google por primera vez: elegir el nombre de usuario.
 * El DNI se pide más adelante, la primera vez que deposita o retira.
 */
export default function CompletarPerfil() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  // Sin sesión de Supabase no hay nada que completar
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/", { replace: true });
      else setEmail(data.session.user?.email ?? "");
    });
  }, [navigate]);

  const guardar = async (e) => {
    e.preventDefault();
    const nombre = username.trim();
    if (!NOMBRE_VALIDO.test(nombre)) return setError("El nombre tiene que tener de 3 a 20 caracteres: letras, números, _ o punto.");
    setError("");
    setCargando(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return navigate("/", { replace: true });

      const res = await fetch(`${API_URL}/api/auth/completar-perfil`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: nombre }),
      });
      if (!res.ok) {
        let mensaje = "No pudimos guardar tu nombre. Probá de nuevo.";
        try {
          mensaje = (await res.json()).message || mensaje;
        } catch {
          /* sin cuerpo */
        }
        // si ya lo había elegido (otra pestaña), seguimos de largo
        if (res.status !== 409 || !mensaje.startsWith("Ya elegiste")) {
          setError(mensaje);
          return;
        }
      }
      const problema = await cargarPerfil();
      if (problema) setError(problema);
      else navigate("/inicio", { replace: true });
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  const salir = () => {
    cerrarSesion();
    navigate("/", { replace: true });
  };

  return (
    <PantallaAcceso
      titulo="Elegí tu nombre de usuario"
      subtitulo={email ? `Entraste como ${email}` : undefined}
      pie={
        <button onClick={salir} className="font-semibold text-white/60 hover:text-white">
          Usar otra cuenta
        </button>
      }
    >
      <form onSubmit={guardar} className="space-y-4">
        <Campo
          etiqueta="Nombre de usuario"
          ayuda="De 3 a 20 caracteres: letras, números, _ o punto. Lo ven los demás jugadores."
          autoCapitalize="none"
          autoCorrect="off"
          maxLength={20}
          placeholder="truquero123"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <Mensaje texto={error} />
        <BotonPrincipal cargando={cargando} className="bg-amber-300 text-neutral-900 hover:bg-amber-200">
          Empezar a jugar
        </BotonPrincipal>
      </form>
    </PantallaAcceso>
  );
}
