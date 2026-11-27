import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { leerAvisoLogin } from "../config";
import { supabase } from "../supabase";
import { Campo, BotonPrincipal } from "./plata";
import { PantallaAcceso, Mensaje, traducirError, cargarPerfil, BotonGoogle, PERFIL_INCOMPLETO } from "./Acceso";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() => leerAvisoLogin() ?? "");
  const [cargando, setCargando] = useState(false);

  // Si ya hay sesión (o vuelve del link de confirmación del email), entra directo
  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo || !data.session) return;
      const problema = await cargarPerfil();
      if (!activo) return;
      if (problema === PERFIL_INCOMPLETO) navigate("/completar-perfil", { replace: true });
      else if (problema) setError(problema);
      else navigate("/inicio", { replace: true });
    });
    return () => {
      activo = false;
    };
  }, [navigate]);

  const entrar = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setError(traducirError(err));
      setCargando(false);
      return;
    }
    const problema = await cargarPerfil();
    if (problema === PERFIL_INCOMPLETO) return navigate("/completar-perfil", { replace: true });
    if (problema) {
      setError(problema);
      setCargando(false);
      return;
    }
    navigate("/inicio", { replace: true });
  };

  return (
    <PantallaAcceso
      titulo="Iniciá sesión"
      pie={
        <>
          ¿No tenés cuenta?{" "}
          <Link to="/registro" className="font-semibold text-amber-200 hover:text-amber-100">
            Registrate
          </Link>
        </>
      }
    >
      <form onSubmit={entrar} className="space-y-4">
        <Campo etiqueta="Email" type="email" autoComplete="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Mensaje texto={error} />
        <BotonPrincipal cargando={cargando} className="bg-amber-300 text-neutral-900 hover:bg-amber-200">
          Entrar
        </BotonPrincipal>
      </form>
      <BotonGoogle onError={setError} />
    </PantallaAcceso>
  );
}
