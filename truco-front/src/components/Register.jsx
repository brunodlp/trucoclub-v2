import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import { supabase } from "../supabase";
import { Campo, BotonPrincipal, limpiarDni } from "./plata";
import { PantallaAcceso, Mensaje, traducirError, cargarPerfil, BotonGoogle } from "./Acceso";

const NOMBRE_VALIDO = /^[A-Za-z0-9_.]{3,20}$/;

/**
 * Registro con Supabase Auth. El nombre de usuario viaja en los datos del registro y la base crea
 * sola el perfil de TrucoClub (trucoclub.usuarios) atado al usuario de Supabase.
 */
export default function Registro() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", dni: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState("");
  const [cargando, setCargando] = useState(false);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const registrar = async (e) => {
    e.preventDefault();
    const username = form.username.trim();
    const email = form.email.trim();
    const dni = limpiarDni(form.dni);
    if (!NOMBRE_VALIDO.test(username)) return setError("El nombre tiene que tener de 3 a 20 caracteres: letras, números, _ o punto.");
    if (!/^\d{7,8}$/.test(dni)) return setError("El DNI tiene que tener 7 u 8 números.");
    if (form.password.length < 6) return setError("La contraseña tiene que tener al menos 6 caracteres.");
    setError("");
    setCargando(true);
    try {
      // 1) ¿El nombre y el DNI están libres? (la base lo vuelve a chequear al crear la cuenta)
      const r = await fetch(`${API_URL}/api/auth/disponible?username=${encodeURIComponent(username)}&dni=${dni}`);
      if (r.ok) {
        const d = await r.json();
        if (!d.disponible) {
          setError(d.motivo);
          return;
        }
      }
      // 2) Crear la cuenta en Supabase Auth
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: { data: { username, dni }, emailRedirectTo: window.location.origin },
      });
      if (err) {
        setError(traducirError(err));
        return;
      }
      // 3a) Si Supabase pide confirmar el email, avisamos
      if (!data.session) {
        setEnviado(email);
        return;
      }
      // 3b) Si no, ya queda logueado
      const problema = await cargarPerfil();
      if (problema) setError(problema);
      else navigate("/inicio", { replace: true });
    } catch (e2) {
      setError(traducirError(e2));
    } finally {
      setCargando(false);
    }
  };

  if (enviado) {
    return (
      <PantallaAcceso titulo="Revisá tu email" pie={<Link to="/" className="font-semibold text-amber-200">Volver a iniciar sesión</Link>}>
        <Mensaje
          tipo="ok"
          texto={`Te mandamos un link a ${enviado} para confirmar tu cuenta. Abrilo y vas a entrar directo (si no lo ves, mirá en spam).`}
        />
      </PantallaAcceso>
    );
  }

  return (
    <PantallaAcceso
      titulo="Creá tu cuenta"
      pie={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link to="/" className="font-semibold text-amber-200 hover:text-amber-100">
            Iniciá sesión
          </Link>
        </>
      }
    >
      <form onSubmit={registrar} className="space-y-4">
        <Campo
          etiqueta="Nombre de usuario"
          name="username"
          ayuda="De 3 a 20 caracteres: letras, números, _ o punto. Lo ven los demás jugadores."
          autoCapitalize="none"
          autoCorrect="off"
          maxLength={20}
          placeholder="truquero123"
          value={form.username}
          onChange={cambiar}
          required
        />
        <Campo
          etiqueta="DNI"
          name="dni"
          ayuda="Lo usamos para verificar que tus depósitos y retiros sean tuyos. Una cuenta por DNI."
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          placeholder="Solo números"
          value={form.dni}
          onChange={cambiar}
          required
        />
        <Campo etiqueta="Email" name="email" type="email" autoComplete="email" placeholder="tu@email.com" value={form.email} onChange={cambiar} required />
        <Campo
          etiqueta="Contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo 6 caracteres"
          value={form.password}
          onChange={cambiar}
          required
        />
        <Mensaje texto={error} />
        <BotonPrincipal cargando={cargando} className="bg-amber-300 text-neutral-900 hover:bg-amber-200">
          Crear cuenta
        </BotonPrincipal>
      </form>
      <BotonGoogle onError={setError} />
    </PantallaAcceso>
  );
}
