import { useState } from "react";
import { Link, useNavigate } from "react-router-dom"; // <-- Sumamos useNavigate

export default function Login() {
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });
  const navigate = useNavigate(); // <-- Inicializamos el navegador interno

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(
        "https://trucoclub-backend.onrender.com/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        },
      );
      const data = await response.text();

      if (response.ok) {
        setMensaje({
          texto: "¡Bienvenido al club! Llevándote a la mesa... 🃏",
          tipo: "exito",
        });
        // Espera 1.5 segundos para mostrar el mensaje lindo y te redirige pasando el username
        setTimeout(
          () =>
            navigate("/juego", {
              state: { usuarioLogueado: formData.username },
            }),
          1500,
        );
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
          Iniciar Sesión
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
              placeholder="truquero123"
              value={formData.username}
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
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Entrar a la mesa
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
          ¿No tenés cuenta?{" "}
          <Link to="/registro" className="text-blue-400 hover:underline">
            Registrate acá
          </Link>
        </p>
      </div>
    </div>
  );
}
