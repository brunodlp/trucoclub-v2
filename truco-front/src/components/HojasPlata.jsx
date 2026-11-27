import { useState } from "react";
import { API_URL, pedirConSesion, leerError, guardarPerfil } from "../config";
import { Hoja, Campo, Copiable, BotonPrincipal, pesos, leerMonto, limpiarDni } from "./plata";

async function enviar(ruta, monto, detalle) {
  const res = await pedirConSesion(`${API_URL}/api/movimientos/${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ monto, detalle }),
  });
  if (!res.ok) throw new Error(await leerError(res));
  return res.json();
}

/**
 * Depositar: 1) muestra a dónde transferir, 2) el jugador carga monto y número de operación.
 * El saldo se acredita cuando un admin confirma que la transferencia llegó.
 */
export function HojaDeposito({ datos, onCerrar, onListo }) {
  const [monto, setMonto] = useState("");
  const [operacion, setOperacion] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const hayCuenta = datos && (datos.alias || datos.cbu);

  const confirmar = async (e) => {
    e.preventDefault();
    const valor = leerMonto(monto);
    if (Number.isNaN(valor)) return setError("Escribí un monto válido, por ejemplo 5000 o 5.000,50.");
    if (datos && valor < datos.minimoDeposito) return setError(`El mínimo para depositar es ${pesos.format(datos.minimoDeposito)}.`);
    setError("");
    setCargando(true);
    try {
      await enviar("deposito", valor, operacion);
      onListo("Pedido enviado. Se acredita cuando lo revisemos.");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <Hoja titulo="Depositar" onCerrar={onCerrar}>
      {!datos ? (
        <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
      ) : !hayCuenta ? (
        <p className="text-sm text-white/60 pb-4">Todavía no hay una cuenta cargada para recibir depósitos. Probá más tarde.</p>
      ) : (
        <form onSubmit={confirmar} className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-white/60 mb-1.5">1. Transferí a esta cuenta</p>
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
          </div>

          <p className="text-xs font-semibold text-white/60 pt-1">2. Avisanos cuánto mandaste</p>
          <Campo
            etiqueta="Monto"
            inputMode="decimal"
            placeholder={`Mínimo ${pesos.format(datos.minimoDeposito)}`}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
          />
          <Campo
            etiqueta="Número de operación"
            ayuda="Lo encontrás en el comprobante de la transferencia."
            placeholder="Ej: 123456789"
            autoCapitalize="characters"
            value={operacion}
            onChange={(e) => setOperacion(e.target.value)}
            required
          />

          {error && <p className="text-sm text-rose-300">{error}</p>}
          <BotonPrincipal cargando={cargando} className="bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600">
            Ya transferí
          </BotonPrincipal>
        </form>
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
