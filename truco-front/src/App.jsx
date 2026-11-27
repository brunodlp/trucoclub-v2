import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Registro from "./components/Register";
import Inicio from "./components/Inicio";
import Juego from "./components/Game";
import Movimientos from "./components/Movimientos";
import Admin from "./components/Admin";
import Premios from "./components/Premios";
import CompletarPerfil from "./components/CompletarPerfil";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Iniciar sesión y registro */}
        <Route path="/" element={<Login />} />
        <Route path="/registro" element={<Registro />} />

        {/* Secciones con la barra de navegación de abajo */}
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/juego" element={<Juego />} /> {/* Mesas (y la partida en pantalla completa) */}
        <Route path="/completar-perfil" element={<CompletarPerfil />} /> {/* después de entrar con Google */}
        <Route path="/premios" element={<Premios />} /> {/* Ranking y Objetivos */}
        <Route path="/ranking" element={<Navigate to="/premios" replace />} />
        <Route path="/movimientos" element={<Movimientos />} />
        <Route path="/admin" element={<Admin />} /> {/* solo admins (el servidor lo chequea) */}

        {/* Cualquier otra dirección vuelve al inicio */}
        <Route path="*" element={<Navigate to="/inicio" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
