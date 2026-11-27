import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "../config";

export default function Registro() {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });
  const navigate = useNavigate(); // Para redirigir después de registrarse

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        },
      );
      const data = await response.text();

      if (response.ok) {
        setMensaje({
          texto: "¡Cuenta creada! Llevándote al login...",
          tipo: "exito",
        });
        // Espera 2 segundos y lo manda a la pantalla de login
        setTimeout(() => navigate("/"), 2000);
      } else {
        setMensaje({ texto: data, tipo: "error" });
      }
    } catch (error) {
      setMensaje({ texto: "Error de conexión con el servidor", tipo: "error" });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-neutral-800 rounded-xl shadow-2xl border border-neutral-700">
        <h2 className="text-3xl font-bold text-center text-white">
          Crear Cuenta
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-neutral-300">
              Usuario
            </label>
            <input
              type="text"
              name="username"
              className="w-full px-4 py-2 text-white bg-neutral-700 border border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-neutral-300">
              Email
            </label>
            <input
              type="email"
              name="email"
              className="w-full px-4 py-2 text-white bg-neutral-700 border border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-neutral-300">
              Contraseña
            </label>
            <input
              type="password"
              name="password"
              className="w-full px-4 py-2 text-white bg-neutral-700 border border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
          >
            Registrarse
          </button>
        </form>

        {mensaje.texto && (
          <div
            className={`p-3 text-center rounded-lg font-medium ${mensaje.tipo === "exito" ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}
          >
            {mensaje.texto}
          </div>
        )}

        <p className="text-sm text-center text-neutral-400">
          ¿Ya tenés cuenta?{" "}
          <Link to="/" className="text-blue-400 hover:underline">
            Iniciá sesión acá
          </Link>
        </p>
      </div>
    </div>
  );
}
