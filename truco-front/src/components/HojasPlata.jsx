import { useCallback, useEffect, useState } from "react";
import { API_URL, pedirConSesion, leerError, guardarPerfil } from "../config";
import { Hoja, Campo, Copiable, BotonPrincipal, pesos, leerMonto, limpiarDni, formatoDni } from "./plata";

async function enviar(ruta, monto, detalle) {
  const res = await pedirConSesion(`${API_URL}/api/movimientos/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ monto, detalle }),
  });
  if (!res.ok) throw new Error(await leerError(res));
  return res.json();
}

async function pedirJson(ruta, opciones) {
  const res = await pedirConSesion(`${API_URL}/api/movimientos${ruta}`, opciones);
  if (!res.ok) throw new Error(await leerError(res));
  return res.json();
}

const mmss = (seg) => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;

/**
 * Depositar:
 *  1. El jugador pone el monto y toca Seguir: arranca el depósito con 10 minutos para transferir.
 *  2. Ve a dónde transferir y la cuenta regresiva. Si un admin lo aprueba, se acredita y el tiempo corta;
 *     si se termina el tiempo, se cancela solo. En los dos casos puede volver a depositar.
 * Si cierra la hoja y la vuelve a abrir, sigue viendo el depósito en curso.
 */
export function HojaDeposito({ datos, dni, onCerrar, onSaldo }) {
  const [paso, setPaso] = useState("cargando"); // cargando | monto | transferir | aprobado | vencido | rechazado
  const [monto, setMonto] = useState("");
  const [deposito, setDeposito] = useState(null); // el movimiento en curso
  const [limite, setLimite] = useState(0); // hora (ms) en que vence
  const [quedan, setQuedan] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const hayCuenta = datos && (datos.alias || datos.cbu);
  const dniVisible = dni && /^\d+$/.test(dni) ? formatoDni(dni) : null;

  const empezar = (activo) => {
    setDeposito(activo.movimiento);
    setLimite(Date.now() + activo.segundosRestantes * 1000);
    setQuedan(activo.segundosRestantes);
    setPaso("transferir");
  };

  // Al abrir: ¿tiene un depósito en curso?
  useEffect(() => {
    pedirJson("/deposito/activo")
      .then((a) => (a.movimiento ? empezar(a) : setPaso("monto")))
      .catch(() => setPaso("monto"));
  }, []);

  // Cuenta regresiva
  useEffect(() => {
    if (paso !== "transferir") return;
    const id = setInterval(() => setQuedan(Math.max(0, Math.round((limite - Date.now()) / 1000))), 1000);
    return () => clearInterval(id);
  }, [paso, limite]);

  // Mientras espera: revisa cada 4 segundos si el admin lo aprobó (o si se venció)
  const revisar = useCallback(async () => {
    if (!deposito) return;
    try {
      const a = await pedirJson("/deposito/activo");
      if (a.movimiento?.id === deposito.id) return; // sigue en curso
      const lista = await pedirJson("");
      const m = lista.find((x) => x.id === deposito.id);
      if (m?.estado === "APROBADO") {
        setPaso("aprobado");
        onSaldo?.(); // refresca el saldo de arriba
      } else if (m?.estado === "RECHAZADO") {
        setMotivo(m.motivoRechazo || "");
        setPaso("rechazado");
      } else {
        setPaso("vencido");
      }
    } catch {
      /* se reintenta en la próxima vuelta */
    }
  }, [deposito, onSaldo]);

  useEffect(() => {
    if (paso !== "transferir") return;
    const id = setInterval(revisar, 4000);
    return () => clearInterval(id);
  }, [paso, revisar]);

  useEffect(() => {
    if (paso === "transferir" && quedan === 0) revisar();
  }, [paso, quedan, revisar]);

  const seguir = async (e) => {
    e.preventDefault();
    const v = leerMonto(monto);
    if (Number.isNaN(v) || v <= 0) return setError("Escribí un monto válido, por ejemplo 5000 o 5.000,50.");
    if (v < datos.minimoDeposito) return setError(`El mínimo para depositar es ${pesos.format(datos.minimoDeposito)}.`);
    if (datos.maximo && v > datos.maximo) return setError(`El máximo es ${pesos.format(datos.maximo)}.`);
    setError("");
    setCargando(true);
    try {
      empezar(await enviar("deposito", v));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const cancelar = async () => {
    setCargando(true);
    try {
      await pedirJson(`/${deposito.id}/cancelar`, { method: "POST" });
    } catch {
      /* si ya se resolvió, igual volvemos al inicio */
    }
    setCargando(false);
    setDeposito(null);
    setPaso("monto");
  };

  const deNuevo = () => {
    setDeposito(null);
    setMonto("");
    setPaso("monto");
  };

  const urgente = quedan <= 60;

  return (
    <Hoja titulo="Depositar" onCerrar={onCerrar}>
      {!datos || paso === "cargando" ? (
        <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
      ) : !hayCuenta ? (
        <p className="text-sm text-white/60 pb-4">Todavía no hay una cuenta cargada para recibir depósitos. Probá más tarde.</p>
      ) : paso === "monto" ? (
        <form onSubmit={seguir} className="space-y-4">
          <Campo
            etiqueta="¿Cuánto vas a depositar?"
            inputMode="decimal"
            placeholder={`Mínimo ${pesos.format(datos.minimoDeposito)}`}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            autoFocus
            required
          />
          <div className="flex gap-2">
            {[1000, 5000, 10000, 20000].filter((n) => n >= datos.minimoDeposito).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMonto(String(n))}
                className="flex-1 h-10 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/15 active:scale-95 transition"
              >
                {pesos.format(n).replace(",00", "")}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <BotonPrincipal cargando={cargando} className="bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600">Seguir</BotonPrincipal>
          <p className="text-[11px] text-center text-white/40">Vas a tener 10 minutos para hacer la transferencia.</p>
        </form>
      ) : paso === "transferir" ? (
        <div className="space-y-4 pb-2">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold text-white/50">Transferí exactamente</p>
              <p className="text-3xl font-black tabular-nums mt-0.5">{pesos.format(deposito.monto)}</p>
            </div>
            <div className={`text-right rounded-2xl px-3 py-1.5 ring-1 ${urgente ? "bg-rose-500/15 ring-rose-400/30" : "bg-white/[.06] ring-white/10"}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Te quedan</p>
              <p className={`text-xl font-black tabular-nums ${urgente ? "text-rose-300" : ""}`}>{mmss(quedan)}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[.06] ring-1 ring-white/10 px-4 divide-y divide-white/10">
            {datos.alias && <Copiable etiqueta="Alias" valor={datos.alias} />}
            {datos.cbu && <Copiable etiqueta="CBU / CVU" valor={datos.cbu} />}
            {datos.titular && (
              <div className="py-2.5">
                <p className="text-[11px] text-white/45">Titular</p>
                <p className="font-semibold">{datos.titular}</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-amber-400/10 ring-1 ring-amber-300/30 px-4 py-3">
            <p className="text-sm font-bold text-amber-200">Solo desde una cuenta a tu nombre</p>
            <p className="text-xs text-amber-100/80 mt-1 leading-relaxed">
              La cuenta desde la que transferís tiene que ser tuya, con tu DNI{dniVisible ? <> (<b className="text-amber-100">{dniVisible}</b>)</> : null}.
              Las transferencias desde cuentas de otras personas no se acreditan.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-white/50">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Esperando tu transferencia… se acredita apenas la confirmamos.
          </div>

          <BotonPrincipal type="button" onClick={onCerrar} className="bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600">
            Ya transferí
          </BotonPrincipal>
          <button type="button" disabled={cargando} onClick={cancelar} className="w-full text-sm font-semibold text-white/50 hover:text-white/80">
            Cancelar depósito
          </button>
        </div>
      ) : (
        <div className="text-center pb-2 pt-2">
          <div
            className={`mx-auto w-16 h-16 rounded-full grid place-items-center text-3xl font-black ${
              paso === "aprobado" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/60"
            }`}
          >
            {paso === "aprobado" ? "✓" : paso === "vencido" ? "⏱" : "✕"}
          </div>
          <p className="text-xl font-black mt-3">
            {paso === "aprobado" ? "¡Depósito acreditado!" : paso === "vencido" ? "Se terminó el tiempo" : "Depósito rechazado"}
          </p>
          <p className="text-sm text-white/60 mt-1.5 leading-relaxed">
            {paso === "aprobado"
              ? `Ya tenés ${pesos.format(deposito.monto)} más en tu saldo. ¡A jugar!`
              : paso === "vencido"
                ? "No vimos la transferencia en los 10 minutos. Si ya la hiciste, escribinos."
                : motivo || "No pudimos confirmar la transferencia."}
          </p>
          <div className="space-y-2.5 mt-5">
            {paso !== "aprobado" && (
              <BotonPrincipal type="button" onClick={deNuevo} className="bg-emerald-500 hover:bg-emerald-400">
                Depositar de nuevo
              </BotonPrincipal>
            )}
            <button type="button" onClick={onCerrar} className="w-full h-12 rounded-full font-semibold bg-white/10 hover:bg-white/15">
              {paso === "aprobado" ? "Listo" : "Cerrar"}
            </button>
          </div>
        </div>
      )}
    </Hoja>
  );
}

/** Retirar: la plata se descuenta del saldo al pedirlo y el admin la transfiere a mano. */
export function HojaRetiro({ datos, saldo, onCerrar, onListo }) {
  const [monto, setMonto] = useState("");
  const [destino, setDestino] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const confirmar = async (e) => {
    e.preventDefault();
    const valor = leerMonto(monto);
    if (Number.isNaN(valor)) return setError("Escribí un monto válido, por ejemplo 5000 o 5.000,50.");
    if (datos && valor < datos.minimoRetiro) return setError(`El mínimo para retirar es ${pesos.format(datos.minimoRetiro)}.`);
    if (valor > saldo) return setError("No te alcanza el saldo para ese monto.");
    setError("");
    setCargando(true);
    try {
      await enviar("retiro", valor, destino);
      onListo("Retiro pedido. Te llega cuando lo procesemos.");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Hoja titulo="Retirar" onCerrar={onCerrar}>
      <form onSubmit={confirmar} className="space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-white/50">Disponible</span>
          <span className="text-lg font-bold tabular-nums">{pesos.format(saldo)}</span>
        </div>

        <div className="relative">
          <Campo
            etiqueta="Monto"
            inputMode="decimal"
            placeholder={datos ? `Mínimo ${pesos.format(datos.minimoRetiro)}` : ""}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setMonto(String(saldo).replace(".", ","))}
            className="absolute right-2 bottom-2 h-8 px-3 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/15"
          >
            Todo
          </button>
        </div>
        <Campo
          etiqueta="Alias o CBU / CVU"
          ayuda="Tiene que ser una cuenta a tu nombre."
          placeholder="tu.alias o 22 números"
          autoCapitalize="none"
          autoCorrect="off"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          required
        />

        {error && <p className="text-sm text-rose-300">{error}</p>}
        <BotonPrincipal cargando={cargando} disabled={saldo <= 0} className="bg-white text-neutral-900 hover:bg-white/90">
          Pedir retiro
        </BotonPrincipal>
        <p className="text-[11px] text-center text-white/40">
          El monto se descuenta ahora. Si se cancela o se rechaza, vuelve a tu saldo.
          {datos?.retirosPorDia ? ` Podés pedir hasta ${datos.retirosPorDia} retiros por día.` : ""}
        </p>
      </form>
    </Hoja>
  );
}

/** Cambiar el nombre de usuario. La sesión sigue igual (Supabase identifica a la cuenta por su id). */
export function HojaNombre({ actual, onCerrar, onListo }) {
  const [nombre, setNombre] = useState(actual ?? "");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const valido = /^[A-Za-z0-9_.]{3,20}$/.test(nombre.trim());

  const confirmar = async (e) => {
    e.preventDefault();
    if (!valido) return setError("De 3 a 20 caracteres: letras, números, _ o punto.");
    setError("");
    setCargando(true);
    try {
      const res = await pedirConSesion(`${API_URL}/api/usuarios/yo/nombre`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      if (!res.ok) throw new Error(await leerError(res));
      const { username } = await res.json();
      guardarPerfil(username);
      onListo(username);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Hoja titulo="Cambiar nombre" onCerrar={onCerrar}>
      <form onSubmit={confirmar} className="space-y-4">
        <Campo
          etiqueta="Nombre nuevo"
          ayuda="De 3 a 20 caracteres: letras, números, _ o punto."
          autoCapitalize="none"
          autoCorrect="off"
          maxLength={20}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <BotonPrincipal cargando={cargando} className="bg-white text-neutral-900 hover:bg-white/90">
          Guardar
        </BotonPrincipal>
        <p className="text-[11px] text-center text-white/40">
          Tu saldo y tus movimientos no cambian. No se puede cambiar con una mesa abierta o en juego.
        </p>
      </form>
    </Hoja>
  );
}

/** Cargar el DNI (cuentas creadas antes de que se pidiera). Una vez cargado, solo lo cambia un admin. */
export function HojaDni({ onCerrar, onListo }) {
  const [dni, setDni] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const confirmar = async (e) => {
    e.preventDefault();
    const limpio = limpiarDni(dni);
    if (!/^\d{7,8}$/.test(limpio)) return setError("El DNI tiene que tener 7 u 8 números.");
    setError("");
    setCargando(true);
    try {
      const res = await pedirConSesion(`${API_URL}/api/usuarios/yo/dni`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dni: limpio }),
      });
      if (!res.ok) throw new Error(await leerError(res));
      onListo();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Hoja titulo="Cargá tu DNI" onCerrar={onCerrar}>
      <form onSubmit={confirmar} className="space-y-4">
        <p className="text-sm text-white/60">
          Lo necesitamos para verificar que los depósitos y retiros sean de una cuenta a tu nombre.
        </p>
        <Campo
          etiqueta="DNI"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          placeholder="Solo números"
          value={dni}
          onChange={(e) => setDni(e.target.value)}
          required
        />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <BotonPrincipal cargando={cargando} className="bg-amber-300 text-neutral-900 hover:bg-amber-200">
          Guardar DNI
        </BotonPrincipal>
        <p className="text-[11px] text-center text-white/40">Una vez guardado no se puede cambiar desde la app.</p>
      </form>
    </Hoja>
  );
}
