# TrucoClub — Plan de producto con user stories

> Armado a partir del código actual (backend Spring Boot en `trucoclub/`, frontend React en `truco-front/`) y del historial de commits. No había documentación previa de producto.
>
> Leyenda: ✅ hecho · 🟡 a medias · 🔜 pendiente

## 🚀 Versión 1 — lo mínimo para salir

**Criterio:** la V1 es **1 vs 1 con plata**, que ya está hecho. Solo entra lo que hace falta para no perder plata, no tener problemas legales y no quedar peor que la competencia en lo básico. Todo lo demás va a la V2.

### Debe estar (bloquea el lanzamiento)

| # | Qué | Historia | Esfuerzo |
|---|---|---|---|
| 1 | ✅ Base en Supabase (PostgreSQL) conectada. Falta: backups activados y prueba de punta a punta en producción | US-8.1 | Chico |
| 2 | ⚠️ **Urgente:** la contraseña de Supabase quedó escrita en un comentario de `application.properties` y el repo es público. Cambiarla en Supabase y borrarla del archivo; revisar que la clave JWT y los datos de pago no tengan valores por defecto reales | US-8.3 | Chico |
| 3 | Registro con **+18 y aceptar términos** (fecha de nacimiento y checkbox) y página de términos y condiciones. Hoy el alta es con Google o email (Supabase Auth) y no pide edad ni términos | US-1.7 (versión mínima de US-9.6) | Chico |
| 4 | ✅ DNI pedido en el primer depósito o retiro (uno por cuenta). Falta: nombre real del titular | US-9.6 (parcial) | Chico |
| 5 | Tests de la plata: apostar, premio, comisión, cancelar mesa, abandonar, depósito y retiro | US-8.2 (solo plata) | Medio |
| 6 | Revisar que recargar la página o cortarse internet te devuelva a tu partida | US-3.9 (verificar) | Chico |
| 7 | Filtro de nombres ofensivos al registrarse y al cambiar el nombre | US-9.5 | Chico |

### Muy recomendado (barato y diferencia)

| # | Qué | Historia | Esfuerzo |
|---|---|---|---|
| 8 | Resumen antes de crear la mesa: "Apostás $X, ganás $Y, a Z puntos, comisión 5%" | US-9.3 | Chico |
| 9 | "Comisión 5%, la más baja" visible en el inicio y en la sala | US-9.4 | Chico |
| 10 | Botón de soporte que abra WhatsApp | US-9.11 (mínima) | Chico |
| 11 | Ocultar o marcar como "Próximamente" Ranking y Objetivos (hoy son de ejemplo) | — | Chico |

### Queda para la V2 o más adelante
Modo gratis, sala privada, torneos, 2 vs 2, flor, ranking, objetivos, avatares, foto de perfil, ficha del rival, filtros y pestañas de la sala, jugar rápido, partidas en juego visibles, Mercado Pago, notificaciones en vivo, persistir partidas ante reinicios (hoy se anulan y se devuelve la plata, lo cual alcanza para la V1).

### Fuera del código, pero bloquea el lanzamiento
- Confirmar el marco legal de juego con dinero real en la provincia donde se opera.
- Términos y condiciones, y política de privacidad redactados.
- Cuenta bancaria o alias real para los depósitos (hoy hay datos de prueba).

---

## Resumen del estado actual

TrucoClub es una plataforma para jugar **truco 1 vs 1 por plata**. El jugador carga saldo por transferencia, crea o se une a una mesa con apuesta, y el ganador se lleva el pozo menos un 5% de comisión. Un administrador aprueba depósitos y retiros y controla a los jugadores.

| Área | Estado |
|---|---|
| Registro y login con Google o email (Supabase Auth) | ✅ |
| Perfil (nombre, saldo, rol) | ✅ — la foto de perfil 🔜 |
| Sala de mesas con apuesta y comisión | ✅ |
| Partida en tiempo real (WebSocket): truco, envido, irse al mazo, turno de 15 s | ✅ — la flor 🔜 |
| Depósitos: el jugador elige el monto, tiene 10 min para transferir y se acredita solo si el CUIT coincide con su DNI | ✅ |
| Retiros con aprobación manual | ✅ |
| DNI por cuenta (se pide en el primer depósito o retiro) | ✅ |
| Notificaciones | ✅ |
| Panel de admin (movimientos, ganancias, jugadores, bloqueo) | ✅ |
| Ranking | 🔜 solo hay una pantalla de "Se viene" |
| Objetivos/desafíos con premio | 🔜 solo hay ejemplos |
| Base de datos en Supabase (PostgreSQL) | ✅ (MySQL local queda como perfil `mysql`) |
| Backend desplegado | 🔜 hoy no corre en ningún lado |
| Partidas que sobreviven a un reinicio del servidor | 🔜 viven en memoria; al reiniciar se anulan y se devuelve la plata |
| Tests automáticos | 🔜 no hay ninguno |

---

## Épica 1 — Cuenta y perfil

- ✅ **US-1.1** Como visitante quiero registrarme con Google o con email y elegir mi nombre de usuario para poder jugar.
- ✅ **US-1.2** Como jugador quiero iniciar sesión y que la sesión dure varios días para no loguearme siempre.
- ✅ **US-1.3** Como jugador quiero ver mi perfil y mi saldo.
- ✅ **US-1.4** Como jugador quiero cambiar mi nombre confirmando con mi contraseña.
- 🔜 **US-1.5** Como jugador quiero subir una foto de perfil para que mi rival me reconozca.
  - Acepta JPG/PNG de hasta 2 MB, se recorta cuadrada.
  - Se ve en la sala, en la mesa y en el ranking.
  - El campo `fotoUrl` ya existe en `Usuario`; falta la subida (puede ir a Supabase Storage).
- 🟡 **US-1.6** Como jugador quiero recuperar mi contraseña si la olvido.
  - El email ya se guarda (Supabase Auth). Falta confirmar que el flujo de recuperación esté activo en el front.
- 🔜 **US-1.7** Como plataforma quiero que solo se registren mayores de 18 años que acepten los términos.
  - Checkbox de términos y declaración de edad en el registro, guardados con fecha.

## Épica 2 — Sala de mesas y apuestas

- ✅ **US-2.1** Como jugador quiero crear una mesa eligiendo el monto ($500 a $350.000) y a cuántos puntos se juega.
- ✅ **US-2.2** Como jugador quiero ver las mesas que esperan rival y unirme a una.
- ✅ **US-2.3** Como jugador quiero cancelar mi mesa antes de que entre alguien y recuperar la apuesta.
- ✅ **US-2.4** Como jugador quiero saber cuánto gano antes de jugar (pozo menos el 5%).
- 🔜 **US-2.5** Como jugador quiero que la sala se actualice sola, sin tener que consultar cada 2 segundos.
  - Hoy el front pide la sala cada 2 s; pasarlo a WebSocket baja la carga del servidor.
- 🔜 **US-2.6** Como jugador quiero invitar a un amigo a una mesa privada con un link.

## Épica 3 — Partida de truco

- ✅ **US-3.1** Como jugador quiero jugar mis cartas por turnos y ver la mesa en tiempo real.
- ✅ **US-3.2** Como jugador quiero cantar truco, retruco y vale cuatro, y responder quiero o no quiero.
- ✅ **US-3.3** Como jugador quiero cantar envido, real envido y falta envido, y ver los tantos de los dos al mismo tiempo.
- ✅ **US-3.4** Como jugador quiero irme al mazo.
- ✅ **US-3.5** Como jugador quiero ver globos con lo que canta cada uno.
- ✅ **US-3.6** Como jugador quiero que, si mi rival no juega en 15 segundos, el juego actúe por él para no quedarme esperando.
- ✅ **US-3.7** Como jugador quiero abandonar una partida (pierdo y gana el otro).
- 🔜 **US-3.8** Como jugador quiero poder jugar con flor (opcional al crear la mesa).
  - Se elige "con flor / sin flor" en las opciones de la mesa.
  - Flor, contraflor y contraflor al resto, con sus reglas sobre el envido.
- 🔜 **US-3.9** Como jugador quiero volver a mi partida si se me corta internet o recargo la página.
  - Al volver, la sala me lleva directo a mi partida en curso con el estado completo.
- 🔜 **US-3.10** Como jugador no quiero perder una partida a medias si el servidor se reinicia.
  - Guardar el estado de la partida en la base (hoy se anula y se devuelve la plata).
- 🔜 **US-3.11** Como jugador quiero ver el historial de mis partidas (rival, resultado, monto).
  - La entidad `HistorialPartida` ya existe; falta el endpoint y la pantalla para el jugador.

## Épica 4 — Plata: depósitos y retiros

- ✅ **US-4.1** Como jugador quiero ver a qué cuenta transferir y los montos mínimos.
- ✅ **US-4.2** Como jugador quiero elegir el monto a depositar y tener 10 minutos para transferir.
- ✅ **US-4.2b** Como jugador quiero que mi depósito se acredite solo cuando la transferencia viene de una cuenta a mi nombre (CUIT con mi DNI).
  - Cada transferencia se acredita una sola vez aunque el aviso llegue repetido.
- ✅ **US-4.2c** Como admin quiero ver las transferencias que no se pudieron identificar, asignarlas a un jugador o marcarlas como devueltas.
- ✅ **US-4.2d** Como plataforma quiero un DNI por cuenta, pedido en el primer depósito o retiro.
- ✅ **US-4.3** Como jugador quiero pedir un retiro a mi alias o CBU/CVU (hasta 2 por día).
- ✅ **US-4.4** Como jugador quiero cancelar un pedido mío que esté pendiente.
- ✅ **US-4.5** Como jugador quiero ver todos mis movimientos y su estado.
- 🔜 **US-4.6** Como jugador quiero depositar con Mercado Pago y que se acredite solo, sin esperar al admin.
  - Webhook de confirmación; el saldo se acredita una sola vez aunque el aviso llegue repetido.
- 🔜 **US-4.7** Como jugador quiero adjuntar el comprobante de la transferencia.

## Épica 5 — Notificaciones

- ✅ **US-5.1** Como jugador quiero recibir avisos (depósito aprobado, retiro rechazado, etc.) y ver cuántos no leí.
- 🔜 **US-5.2** Como jugador quiero que las notificaciones lleguen al instante (WebSocket) y no al recargar.

## Épica 6 — Ranking y objetivos

- 🔜 **US-6.1** Como jugador quiero ver un ranking de los que más ganan para competir.
  - Ranking semanal y mensual por partidas ganadas y por plata ganada.
  - Mi posición siempre visible aunque no esté en el top.
- 🔜 **US-6.2** Como jugador quiero cumplir objetivos (ej. "ganá 5 partidas esta semana") y recibir un premio.
  - El admin crea objetivos con condición, período y premio.
  - Al cumplirlo se acredita el premio como movimiento y llega una notificación.
- 🔜 **US-6.3** Como jugador quiero ver mis estadísticas (partidas, % de victorias, plata ganada).

## Épica 7 — Administración

- ✅ **US-7.1** Como admin quiero aprobar o rechazar depósitos y retiros, del más viejo al más nuevo.
- ✅ **US-7.2** Como admin quiero ver las ganancias por comisión en un rango de fechas.
- ✅ **US-7.3** Como admin quiero buscar jugadores y ver su ficha (saldo, estadísticas, movimientos, partidas).
- ✅ **US-7.4** Como admin quiero bloquear y desbloquear cuentas con un motivo.
- 🔜 **US-7.5** Como admin quiero ajustar el saldo de un jugador a mano, con motivo y registro de quién lo hizo.
- 🔜 **US-7.6** Como admin quiero ver las partidas en curso y anular una si hay un problema, devolviendo las apuestas.
- 🔜 **US-7.7** Como admin quiero gestionar objetivos (ver US-6.2).

## Épica 8 — Técnica e infraestructura

- ✅ **US-8.1** Como equipo queremos que el backend se conecte a Supabase (PostgreSQL).
  - Hecho: driver de Postgres, *session pooler*, esquema `trucoclub` (`esquema_supabase.sql`), pool de 5 conexiones y perfil `mysql` para desarrollo local.
  - Falta: activar backups y probarlo en producción.
- 🔜 **US-8.2** Como equipo queremos tests de la lógica del truco (`Partida`) y de la plata (apuestas, premios, retiros).
- 🟡 **US-8.3** Como equipo queremos sacar contraseñas y datos de pago del `application.properties` (todo por variables de entorno).
  - Ya existe `secretos.properties` (fuera de GitHub) para desarrollo y variables de entorno para producción.
  - ⚠️ Pendiente urgente: la contraseña de Supabase sigue escrita en un comentario del archivo y el repo es público. Hay que cambiarla.
- 🔜 **US-8.4** Como equipo queremos resolver las 15 vulnerabilidades que marca `npm audit` en el frontend.
- 🔜 **US-8.5** Como equipo queremos reemplazar el README de plantilla por uno con cómo levantar el proyecto.

## Épica 9 — Mejoras a partir de la competencia (TRUCON)

> Detalle en [analisis-competencia.md](analisis-competencia.md).

- 🔜 **US-9.1** Como jugador quiero una sala con pestañas (*Mesas* / *Torneos* / *En juego*) y filtros por monto y puntos para encontrar rápido dónde jugar.
  - Las mesas llenas no aparecen en la lista de mesas disponibles.
  - Los filtros se recuerdan entre visitas.
- 🔜 **US-9.2** Como jugador quiero un botón "Jugar rápido": elijo el monto y me empareja con alguien que esté esperando ese monto o me crea la mesa.
- 🔜 **US-9.3** Como jugador quiero ver un resumen antes de confirmar la mesa: "Apostás $X, ganás $Y, a Z puntos, sin flor, comisión 5%".
- 🔜 **US-9.4** Como plataforma quiero comunicar que tenemos la comisión más baja (5% contra el 7% de la competencia) en la sala y en el inicio.
- 🔜 **US-9.5** Como plataforma quiero filtrar nombres de usuario ofensivos al registrarse y al cambiar el nombre.
  - El admin puede forzar el cambio de nombre de un usuario.
- 🔜 **US-9.6** Como jugador quiero verificar mi identidad por pasos: juego gratis sin datos, nombre y fecha de nacimiento para la primera apuesta, y DNI y teléfono para el primer retiro.
  - Reemplaza y amplía la US-1.7.
- 🔜 **US-9.7** Como jugador nuevo quiero jugar partidas gratis (sin apuesta) para probar la plataforma.
  - No suman al ranking de plata; pueden sumar a estadísticas aparte.
- 🔜 **US-9.8** Como jugador quiero ver las partidas en juego en la sala (jugadores y progreso del marcador) para sentir que hay comunidad.
- 🔜 **US-9.9** Como jugador quiero elegir un avatar de una galería para tener identidad sin subir una foto.
  - Complementa la US-1.5.
- 🔜 **US-9.10** Como jugador quiero ver la ficha de mi rival (partidas, % de victorias, nivel) antes de sentarme.
- 🔜 **US-9.11** Como jugador quiero un botón de soporte siempre visible para consultar por pagos o problemas.
- 🔜 **US-9.12** Como jugador quiero anotarme en torneos de 4 jugadores con inscripción y premio.
  - Eliminación directa, el premio es el pozo menos la comisión.
  - Si un torneo no se llena en X minutos, se devuelven las inscripciones.
- 🔜 **US-9.13** Como jugador quiero jugar 2 vs 2 con un compañero elegido o asignado.
  - Pantalla de elegir equipo mientras haya lugar.
  - Requiere adaptar `Partida` a 4 jugadores (turnos, envido por equipo, señas opcionales).
- 🔜 **US-9.14** Como jugador de escritorio quiero que la sala aproveche el ancho de la pantalla (lista y detalle lado a lado).

---

## Plan propuesto por etapas

**Etapa 1 — Base sólida y diferenciales rápidos**
US-8.1 Supabase · US-8.3 secretos fuera del repo · US-8.2 tests de partida y plata · US-9.6 verificación por pasos (incluye US-1.7) · US-9.5 moderación de nombres · US-9.3 + US-9.4 resumen y comisión del 5% visible

**Etapa 2 — Sala mejor que la competencia**
US-9.1 pestañas y filtros · US-9.2 jugar rápido · US-2.5 sala en tiempo real · US-9.8 partidas en juego visibles · US-9.14 diseño de escritorio

**Etapa 3 — Que no se pierda nada**
US-3.9 reconexión · US-3.10 partidas persistidas · US-3.11 historial para el jugador · US-5.2 notificaciones en vivo · US-9.11 soporte

**Etapa 4 — Enganche**
US-9.7 modo gratis · US-2.6 sala privada · US-9.9 avatares · US-9.10 ficha del rival · US-6.1 ranking · US-6.3 estadísticas

**Etapa 5 — Crecimiento**
US-9.12 torneos · US-3.8 flor · US-6.2 + US-7.7 objetivos · US-4.6 Mercado Pago · US-9.13 2 vs 2 · US-7.5 / US-7.6 herramientas de admin

> Nota: al ser una plataforma con apuestas de dinero real, conviene confirmar los requisitos legales (licencia de juego online según la provincia, verificación de edad) antes de abrirla al público.
