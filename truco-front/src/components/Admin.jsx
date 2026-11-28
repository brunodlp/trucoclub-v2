import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, obtenerUsuario, pedirConSesion, leerError } from "../config";
import Navegacion, { Encabezado } from "./Navegacion";
import AdminGanancias from "./AdminGanancias";
import AdminJugadores from "./AdminJugadores";
import AdminTransferencias from "./AdminTransferencias";
import { pesos, formatearFecha, EstadoChip, IconoTipo, Hoja, Copiable, BotonPrincipal, Aviso, formatoDni } from "./plata";

const NOMBRE = { DEPOSITO: "Depósito", RETIRO: "Retiro" };

/** El jugador tiene 10 minutos para transferir; después el depósito se cancela solo. */
function venceEn(creado) {
  const min = Math.ceil(10 - (Date.now() - new Date(creado).getTime()) / 60000);
  return min > 0 ? `Se cancela solo en ${min} min si no lo aprobás.` : "Por vencer…";
}

function Pendiente({ m, onAprobar, onRechazar }) {
  const deposito = m.tipo === "DEPOSITO";
  return (
    <li className="rounded-3xl bg-white/[.05] ring-1 ring-white/10 p-4">
      <div className="flex items-center gap-3">
        <IconoTipo tipo={m.tipo} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight truncate">
            {NOMBRE[m.tipo]} · <span className="text-amber-200">{m.usuario}</span>
          </p>
          <p className="text-xs text-white/45 mt-0.5">{formatearFecha(m.creado)}</p>
          <p className="text-xs mt-0.5 whitespace-nowrap">
            {m.dni ? <span className="text-white/75 font-semibold">DNI {formatoDni(m.dni)}</span> : <span className="text-rose-300">Sin DNI</span>}
          </p>
        </div>
        <p className="text-xl font-black tabular-nums">{pesos.format(m.monto)}</p>
      </div>
      {deposito ? (
        <p className="mt-3 rounded-2xl bg-black/20 px-3.5 py-2.5 text-xs text-white/70 leading-relaxed">
          Buscá en el banco una transferencia de <b className="text-white">{pesos.format(m.monto)}</b> desde una cuenta
          con DNI <b className="text-white">{m.dni ? formatoDni(m.dni) : "?"}</b>. Si viene de otra persona, rechazala.
          <span className="block mt-1 text-amber-200/90">{venceEn(m.creado)}</span>
        </p>
      ) : (
        <div className="mt-3 rounded-2xl bg-black/20 px-3.5">
          <Copiable etiqueta="Transferir a (alias / CBU)" valor={m.detalle} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5 mt-3">
        <button onClick={() => onRechazar(m)} className="h-11 rounded-full font-semibold bg-white/10 hover:bg-white/15 active:scale-95 transition">
          Rechazar
        </button>
        <button onClick={() => onAprobar(m)} className="h-11 rounded-full font-semibold bg-emerald-500 hover:bg-emerald-400 active:scale-95 transition">
          Aprobar
        </button>
      </div>
    </li>
  );
}

function Resuelto({ m }) {
  return (
    <li className="flex gap-3 py-3">
      <IconoTipo tipo={m.tipo} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-tight truncate">
            {NOMBRE[m.tipo]} · {m.usuario}
          </p>
          <p className="shrink-0 font-bold tabular-nums">{pesos.format(m.monto)}</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <EstadoChip estado={m.estado} />
          <span className="text-[11px] text-white/40 truncate">
            {formatearFecha(m.resuelto)}
            {m.resueltoPor ? ` · por ${m.resueltoPor}` : ""}
          </span>
        </div>
        {m.motivoRechazo && <p className="text-xs text-white/50 mt-1">{m.motivoRechazo}</p>}
      </div>
    </li>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const usuario = obtenerUsuario();
  const [pestania, setPestania] = useState("pendientes");
  const [pendientes, setPendientes] = useState(null);
  const [resueltos, setResueltos] = useState(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [accion, setAccion] = useState(null); // { tipo: "aprobar" | "rechazar", m }
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [sinIdentificar, setSinIdentificar] = useState(0);

  const traer = useCallback(async (estado) => {
    const res = await pedirConSesion(`${API_URL}/api/admin/movimientos?estado=${estado}`);
    if (res.status === 403) {
      setSinPermiso(true);
      return null;
    }
    return res.ok ? res.json() : null;
  }, []);

  const cargar = useCallback(() => {
    traer("PENDIENTE").then((l) => l && setPendientes(l)).catch(() => {});
    traer("RESUELTOS").then((l) => l && setResueltos(l)).catch(() => {});
    pedirConSesion(`${API_URL}/api/admin/transferencias?estado=SIN_IDENTIFICAR`)
      .then((r) => (r.ok ? r.json() : null))
      .then((l) => l && setSinIdentificar(l.length))
      .catch(() => {});
  }, [traer]);

  useEffect(() => {
    if (!usuario) {
      navigate("/");
      return;
    }
    cargar();
    const id = setInterval(cargar, 10000);
    return () => clearInterval(id);
  }, [usuario, navigate, cargar]);

  const mostrarAviso = (t) => {
    setAviso(t);
    setTimeout(() => setAviso(""), 2400);
  };

  const confirmar = async () => {
    const { tipo, m } = accion;
    setEnviando(true);
    try {
      const res = await pedirConSesion(`${API_URL}/api/admin/movimientos/${m.id}/${tipo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: tipo === "rechazar" ? JSON.stringify({ motivo }) : undefined,
      });
      mostrarAviso(res.ok ? (tipo === "aprobar" ? "Aprobado" : "Rechazado") : await leerError(res));
    } catch (e) {
      mostrarAviso(e.message);
    } finally {
      setEnviando(false);
      setAccion(null);
      setMotivo("");
      cargar();
    }
  };

  if (!usuario) return null;

  const explicacion = (a) => {
    const plata = pesos.format(a.m.monto);
    if (a.tipo === "aprobar") {
      return a.m.tipo === "DEPOSITO"
        ? `Confirmá que te llegó la transferencia de ${plata} desde una cuenta a nombre de ${a.m.usuario}. Se le suman a su saldo.`
        : `Confirmá que ya le transferiste ${plata} a ${a.m.detalle}. Su saldo ya estaba descontado.`;
    }
    return a.m.tipo === "DEPOSITO"
      ? `El depósito de ${plata} no se acredita.`
      : `Los ${plata} vuelven al saldo de ${a.m.usuario}.`;
  };

  return (
    <div className="min-h-[100dvh] bg-app text-white pb-28">
      <Encabezado />
      <main className="max-w-md mx-auto px-4">
        <h1 className="text-3xl font-extrabold tracking-tight mt-4 mb-4">Admin</h1>

        {sinPermiso ? (
          <p className="text-sm text-white/60">No tenés permiso para ver esta sección.</p>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 mb-4 [scrollbar-width:none]">
              {[
                ["pendientes", `Pendientes${pendientes?.length ? ` (${pendientes.length})` : ""}`],
                ["transferencias", `Transferencias${sinIdentificar ? ` (${sinIdentificar})` : ""}`],
                ["jugadores", "Jugadores"],
                ["ganancias", "Ganancias"],
                ["historial", "Historial"],
              ].map(([clave, texto]) => (
                <button
                  key={clave}
                  onClick={() => setPestania(clave)}
                  className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold transition ${
                    pestania === clave ? "bg-white text-neutral-900" : "bg-white/[.07] ring-1 ring-white/10 text-white/70 hover:text-white"
                  }`}
                >
                  {texto}
                </button>
              ))}
            </div>

            {pestania === "pendientes" &&
              (pendientes === null ? (
                <div className="h-40 rounded-3xl bg-white/5 animate-pulse" />
              ) : pendientes.length === 0 ? (
                <p className="text-center text-sm text-white/50 py-10">No hay pedidos pendientes.</p>
              ) : (
                <ul className="space-y-3">
                  {pendientes.map((m) => (
                    <Pendiente
                      key={m.id}
                      m={m}
                      onAprobar={(x) => setAccion({ tipo: "aprobar", m: x })}
                      onRechazar={(x) => setAccion({ tipo: "rechazar", m: x })}
                    />
                  ))}
                </ul>
              ))}

            {pestania === "transferencias" && <AdminTransferencias onAviso={mostrarAviso} onCantidad={setSinIdentificar} />}

            {pestania === "ganancias" && <AdminGanancias />}

            {pestania === "jugadores" && <AdminJugadores />}

            {pestania === "historial" &&
              (resueltos === null ? (
                <div className="h-40 rounded-3xl bg-white/5 animate-pulse" />
              ) : resueltos.length === 0 ? (
                <p className="text-center text-sm text-white/50 py-10">Todavía no hay movimientos resueltos.</p>
              ) : (
                <ul className="rounded-3xl bg-white/[.04] ring-1 ring-white/10 px-4 divide-y divide-white/10">
                  {resueltos.map((m) => (
                    <Resuelto key={m.id} m={m} />
                  ))}
                </ul>
              ))}
          </>
        )}
      </main>

      {accion && (
        <Hoja
          titulo={`${accion.tipo === "aprobar" ? "Aprobar" : "Rechazar"} ${NOMBRE[accion.m.tipo].toLowerCase()}`}
          onCerrar={() => setAccion(null)}
        >
          <p className="text-sm text-white/60 mb-4">{explicacion(accion)}</p>
          {accion.tipo === "rechazar" && (
            <label className="block mb-4">
              <span className="block text-xs font-semibold text-white/60 mb-1.5">Motivo (lo ve el jugador)</span>
              <input
                value={motivo}
                maxLength={200}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: no encontramos la transferencia"
                className="w-full h-12 rounded-2xl bg-white/[.06] ring-1 ring-white/10 focus:ring-2 focus:ring-amber-300/70 outline-none px-4 placeholder:text-white/25"
              />
            </label>
          )}
          <div className="space-y-2.5">
            <BotonPrincipal
              cargando={enviando}
              onClick={confirmar}
              className={accion.tipo === "aprobar" ? "bg-emerald-500 hover:bg-emerald-400" : "bg-rose-500 hover:bg-rose-400"}
            >
              {accion.tipo === "aprobar" ? "Sí, aprobar" : "Sí, rechazar"}
            </BotonPrincipal>
            <button onClick={() => setAccion(null)} className="w-full h-12 rounded-full font-semibold bg-white/10 hover:bg-white/15">
              Volver
            </button>
          </div>
        </Hoja>
      )}

      <Aviso texto={aviso} />
      <Navegacion />
    </div>
  );
}
