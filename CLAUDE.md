# Agendia

Responde siempre en español. Proyecto de la marca DesarroJoss. Vive en `DesarroJoss/proyectos/Agendia`, pero es un **repo totalmente independiente**.
- **Repo:** `desarrojoss/Agendia` (rama `main`). **Público** (decidido: es parte del portafolio, y además hace gratis el cron de GitHub Actions).
- **Producción:** https://agendia-phi.vercel.app (Vercel, equipo `desarro-joss`, proyecto `agendia`; cada push a `main` despliega solo).

## Lee primero
- **[SPEC.md](SPEC.md):** alcance completo, modelo de datos, ejecuciones y límites. Es la fuente de verdad.
- Al cerrar la ejecución 10 se crea **DOCUMENTACION.md**, la referencia completa (como la de Ordenia). Desde entonces manda ese archivo.

## Estado
- **2026-11-14:** plan aprobado por Joss. **Ejecuciones 0 a 5 cerradas** (base, acceso, configuración, motor de disponibilidad, reserva pública y gestión de la cita sin cuenta + lista de espera, verificados de punta a punta).
- **Siguiente:** ejecución 6 (Pagos y anticipos con Stripe de prueba), cuando Joss dé la orden. 11 ejecuciones (0–10) en total.

| Ejecución | Estado |
|---|---|
| 0 Base | **cerrada** (2026-11-14) |
| 1 Negocios y acceso | **cerrada** (2026-11-14) |
| 2 Configuración | **cerrada** (2026-11-14) |
| 3 Motor de disponibilidad | **cerrada** (2026-11-14) |
| 4 Reserva pública | **cerrada** (2026-11-14) |
| 5 Gestionar sin cuenta y lista de espera | **cerrada** (2026-11-14) |
| 6 Pagos y anticipos (Stripe, prueba) | pendiente |
| 7 Panel | pendiente |
| 8 Avisos (correo + WhatsApp + cron) | pendiente |
| 9 Superadministrador | pendiente |
| 10 Demo y cierre | pendiente |

## Servicios creados (ejecución 0)
- **Firebase:** proyecto `agendia-joss` (número 993694410954), Firestore `(default)` en `nam5` con reglas cerradas (solo el Admin SDK entra), Auth con correo y contraseña **activado**, plan Spark. App web "Agendia Web". Cuenta dueña: `desarrojoss@gmail.com`.
- **Service account:** `firebase-adminsdk-fbsvc@agendia-joss.iam.gserviceaccount.com`, en base64 en `.env.local` y en Vercel (secreto). Nunca pasó por el chat.
- **Vercel:** proyecto `agendia` enlazado al repo; variables `FIREBASE_SERVICE_ACCOUNT_BASE64` (secreta) y `NEXT_PUBLIC_FIREBASE_API_KEY` en Production.
- **Verificado:** `GET /api/health` responde `{"ok":true}` en local y en producción (escribe y lee un documento en Firestore).
- **Trampas:** las APIs de Firestore, Identity Toolkit e IAM se habilitaron por la API de Service Usage; los permisos del service account tardan ~30 s en propagarse (un `PERMISSION_DENIED` justo después de crearlo es normal). Auth por correo solo se activa desde la consola (Identity Platform exige facturación): ya está hecho.
- **Pendientes de cuentas** (para ejecuciones posteriores): Cloudinary (reusar la de Ordenia), Resend, Stripe de pruebas, Meta for Developers.

## Acceso y aislamiento (ejecución 1)
- **Rutas:** `/registro` (crea usuario + negocio + enlace, paso 1 del asistente), `/login`, `/panel` (protegido), `/<slug>` (página pública del negocio; por ahora solo el encabezado), `proxy.ts` revisa la cookie `session` en `/panel`.
- **Sesión:** cookie `session` (Firebase session cookie, 5 días, httpOnly). `src/lib/auth-server.ts`: `getMember()`, `requireMember()` (dueño o profesional), `requireDueno()` y `negocioRef(bizId)`.
- **Modelo:** `members/{uid}` = `{ bizId, rol: "dueno" | "profesional", staffId }` es la ÚNICA fuente del `bizId`. Estar en Firebase Auth no basta: sin documento `members` no se entra (la API key pública deja crear usuarios sueltos). `slugs/{slug}` garantiza enlaces únicos (transacción). Los enlaces reservados y el formato viven en `src/lib/slug.ts` (con prueba).
- **Prueba de punta a punta:** `BASE_URL=http://localhost:3100 node scripts/e2e-acceso.mjs` (Playwright; crea 2 negocios de prueba y los borra al terminar). 17 comprobaciones, todas bien: redirección sin sesión, enlace libre/ocupado/reservado, correo repetido, aislamiento entre negocios (un `bizId` en la URL se ignora), salir, contraseña mala, usuario sin negocio.
- **Límites conocidos (demo gratis):** el registro es abierto y sin captcha ni verificación de correo; Firebase Auth no se puede cerrar sin Identity Platform (facturación). Si hiciera falta frenar abuso: verificar correo o un campo de invitación.

## Configuración (ejecución 2)
- **Panel** (`/panel/*`, `layout.tsx` exige sesión): Resumen con el asistente de 4 pasos y el enlace para compartir; Servicios, Equipo, Sedes, Bloqueos y Negocio (estos 5 solo para el dueño con `requireDueno()`; un profesional vuelve a `/panel`).
- **Datos** (todo bajo `businesses/{bizId}/`): `locations` (todo negocio nace con "Sede principal"), `services` (duración de 5 en 5, precio COP, anticipo ninguno/porcentaje/monto, sedes, orden), `staff` (sede, servicios, foto, horario por día con varios tramos = pausas, `icsToken` para el calendario de la ejecución 7), `blocks` (alcance negocio/sede/persona; se guardan en UTC desde la hora de Bogotá).
- **Reglas del negocio** en `businesses/{bizId}.reglas`: anticipación (por defecto 2 h), ventana (30 días), límite para cancelar (4 h), intervalo 15 o 30 min, margen entre citas. El enlace (slug) se puede cambiar: transacción que reserva el nuevo y libera el viejo.
- **Lógica pura con pruebas** (`npm test`, 15 pruebas): `slug.ts`, `tiempo.ts` (zona ↔ UTC con `Intl`, incluso horario de verano), `validaciones.ts` (todo lo que el dueño configura). Las acciones de `src/app/panel/actions-config.ts` empiezan con `requireDueno()` y usan el `bizId` de la sesión; un id de otro negocio devuelve 404.
- **Imágenes (Cloudinary, cuenta de Ordenia):** subida firmada desde el servidor, directo del navegador a Cloudinary, en la carpeta `agendia/<bizId>/(logo|personal)/`. Solo se aceptan URLs de esa carpeta (`imagenValida`). Las variables `CLOUDINARY_*` están en `.env.local` y en Vercel (secretas).
- **Prueba de punta a punta:** `BASE_URL=http://localhost:3100 node scripts/e2e-config.mjs` (31 comprobaciones: sedes, servicios con anticipo, orden, ocultar, foto real a Cloudinary, horario inválido, bloqueos en UTC, datos y reglas, cambio de enlace, aislamiento entre negocios, rol profesional). Borra todo lo que crea, incluidas las imágenes.
- **Pendiente para la ejecución 7:** invitar al profesional por correo (el campo `email` ya existe) y su calendario ICS.

## Motor de disponibilidad (ejecución 3)
- **`src/lib/disponibilidad.ts`** (puro, sin Firebase ni Next): `horasLibres(entrada)` devuelve las horas que puede reservar un cliente y quién está libre en cada una. Aplica a la vez: horario con pausas (tramos), duración completa dentro del tramo, intervalo de 15/30 min contado desde el inicio del tramo, citas (un profesional no atiende dos a la vez) con margen, bloqueos (persona, sede o negocio; terminar justo cuando empieza un bloqueo SÍ se permite), anticipación mínima, ventana de reserva y días pasados, y la zona horaria del negocio (el "hoy" y el día de la semana se miran en Bogotá; todo se guarda en UTC).
- **Otras funciones:** `diasDisponibles()` (días con cupo para el calendario), `elegirPersonal()` ("cualquiera" reparte la carga: el que tiene menos citas ese día; empate = el primero de la lista), `sigueLibre()` (revalidar al reservar), `ocupaTiempo()` (solo las canceladas liberan la hora; "pendiente_pago" retiene hasta `retieneHasta` y luego se libera sola), `ignorarCitaId` (al reprogramar, la cita no se estorba a sí misma).
- **Estados de cita** (`EstadoCita` en `types.ts`): `pendiente_pago`, `confirmada`, `atendida`, `no_llego`, `cancelada`. Las citas viven en `businesses/{bizId}/appointments/{id}` con `staffId`, `servicioId`, `inicio`, `fin` (UTC), `estado`, `retieneHasta?`.
- **`src/lib/disponibilidad-datos.ts`:** `consultar(bizId, consulta)` carga de Firestore lo que el motor necesita (negocio, servicio, personal de la sede que lo ofrece, bloqueos y citas del rango) y lo calcula. No usa la sesión: la reserva pública de la ejecución 4 lo reutiliza con un `bizId` resuelto desde el enlace.
- **Pantalla "Disponibilidad"** (`/panel/disponibilidad`, solo dueño): muestra qué horas vería hoy un cliente (servicio, profesional o "cualquiera", fecha) y los próximos días con cupo.
- **Pruebas:** `npm test` (35 en total; 20 son del motor: pausas, duración, intervalo, citas, margen, los 3 alcances de bloqueo, varios días, anticipación, ventana, zona horaria, varios profesionales, reprogramar, horario de verano) y `BASE_URL=... node scripts/e2e-disponibilidad.mjs` (15 comprobaciones con datos reales: cita, pago pendiente vigente y vencido, cancelada, bloqueo, "cualquiera", domingo, fuera de ventana, calendario y anticipación). Las pruebas encontraron un error real: las citas sin id no se contaban en el reparto de "cualquiera" (corregido).

## Reserva pública (ejecución 4)
- **Página `/<slug>`** (primero móvil): pasos que se van resolviendo (sede si hay 2 o más → servicio → profesional o "cualquiera", se salta si solo hay uno → día y hora → datos). Solo se ofrecen las horas que devuelve el motor. Lógica del flujo en `src/components/reserva-flow.tsx`; datos públicos (sin correos ni tokens) en `src/lib/publico.ts`.
- **Reservar** (`src/app/actions-reserva.ts`, acción pública): NO confía en el cliente. Recalcula la disponibilidad, elige al profesional si dijo "cualquiera" y crea la cita en una **transacción con candados**: un documento `businesses/{biz}/locks/{staffId}_{tramo de 5 min}` por cada tramo que ocupa la cita (+ el margen entre citas). Firestore no deja crear dos veces el mismo, así que dos clientes nunca se quedan con la misma hora. Un candado de una cita cancelada o con el pago vencido se sobrescribe solo (`ocupaTiempo`). Si hay choque y era "cualquiera", reintenta con otro profesional (hasta 3 veces).
- **Citas** (`businesses/{biz}/appointments`): guardan servicio, precio, profesional, sede, hora en UTC y datos del cliente. Con anticipo → `pendiente_pago` con `retieneHasta` (15 min); sin anticipo → `confirmada`. El pago real con Stripe es la ejecución 6; por ahora la pantalla lo dice con claridad.
- **Enlace privado `/cita/<token>`:** token de 24 bytes aleatorios; en la base solo el hash (`citaTokens/{sha256}` → `{bizId, citaId}`). La página muestra la cita, "Agregar a mi calendario" (`/cita/<token>/calendario.ics`, archivo .ics con aviso 1 h antes) y "Avisar al negocio por WhatsApp" (mensaje ya armado). Cancelar y reprogramar: ejecución 5.
- **Frenos de abuso:** máximo 3 citas abiertas por número de WhatsApp en un negocio; campo trampa oculto para bots; un negocio suspendido da 404.
- **Lógica pura con pruebas** (`npm test`, 44): `reservas.ts` (candados, anticipo), `ics.ts`, `whatsapp.ts`, `validaciones.ts` (datos del cliente).
- **Prueba de punta a punta:** `BASE_URL=... node scripts/e2e-reserva.mjs` (34 comprobaciones, con celular de 390 px): flujo completo, hora exacta en UTC, candados, token solo como hash, .ics, WhatsApp, validaciones, trampa, anticipo, hora que se ocupa mientras se llena el formulario, límite por WhatsApp, 2 sedes, y **concurrencia: 4 clientes pulsan "Confirmar" a la vez por la misma hora (3 rondas) y gana exactamente 1; con "cualquiera" y 2 profesionales, 3 clientes a la vez → 2 reservan y el tercero recibe aviso**.
- **Trampas:** Next pone su propio `role="alert"` (anunciador de rutas) en todas las páginas: en pruebas usar `p[role="alert"]` para los avisos de la app. Las pruebas encontraron 2 errores reales de la pantalla (corregidos): se podía tocar una hora de un día mientras cargaba otro, y el aviso de "hora ocupada" se borraba al refrescar las horas.

## Gestionar la cita y lista de espera (ejecución 5)
- **Desde `/cita/<token>`** (sin cuenta): "Cambiar el día o la hora" (`/cita/<token>/reprogramar`) y "Cancelar mi cita" (con confirmación de dos toques). Reglas en `gestionDeCita()` (`reservas.ts`, con prueba): hasta `limiteCancelarMin` antes (4 h por defecto) se puede cancelar y mover; pasado el límite solo queda "Escribir al negocio" (WhatsApp) y entrar directo a `/reprogramar` devuelve a la cita. Una cita **pendiente_pago** se puede cancelar mientras no empiece, pero no mover. Todo lo valida el servidor (`src/app/actions-cita.ts`), no los botones.
- **Reprogramar:** mismo servicio, sede y profesional. `consultar()` acepta `ignorarCitaId` (la cita no se estorba a sí misma). En una transacción toma los candados nuevos (ignorando los suyos propios), suelta los viejos y actualiza la cita (`inicioAnterior`, `reprogramadaEn`, `avisos: {}` para que la ejecución 8 avise de nuevo). Dos clientes que cambian a la misma hora a la vez: gana uno.
- **Cancelar:** estado `cancelada`, `canceladaPor: "cliente"`. Los candados quedan pero ya no cuentan (`ocupaTiempo`) y se sobrescriben al reservar.
- **Lista de espera** (`businesses/{biz}/waitlist/{id}` = `{ servicioId, sedeId, fecha, cliente, estado, hueco?, avisos, creado }`): en el paso de día y hora, "¿No hay hora el día que quieres? Avísame si se libera algo" (`espera-form.tsx`, `unirseListaEspera`). Solo deja anotarse si ese día NO tiene horas (si tiene, le pide reservar), no duplica (mismo número+servicio+sede+día) y máximo 5 avisos abiertos por número. Estados: `esperando` → `hueco_libre` → `reservado`.
- **Al liberarse un hueco** (cancelar o mover una cita): `marcarEspera()` (`lib/espera.ts`) revisa si el día de verdad tiene cupo para cada servicio en espera y marca los avisos `hueco_libre` con `hueco: { fecha, hora, en }`. **El envío del correo y del WhatsApp es de la ejecución 8** (usará el campo `avisos`, idempotente) con el enlace `enlaceHueco(slug, …)` = `/<slug>?sede=&servicio=&fecha=&hora=`: esa página abre la reserva con todo ya elegido (`ReservaFlow` recibe `inicial`; datos inventados se ignoran). Gana quien reserve primero (candados). Al reservar, el aviso del cliente pasa a `reservado` (`marcarReservada`). **La vista del dueño de la lista de espera es de la ejecución 7.**
- **Componentes compartidos:** `dias-horas.tsx` (tira de días + horas; lo usan la reserva y el cambio de hora).
- **Pruebas:** `npm test` (46) y `BASE_URL=... node scripts/e2e-gestion.mjs` (31 comprobaciones, celular de 390 px): mover con y sin cruce consigo misma (candados exactos), 2 cambios a la misma hora a la vez → gana 1, cancelar con confirmación, hora cancelada que se vuelve a reservar, límite de horas, anticipo sin pagar, enlaces inventados, lista de espera (alta, día con horas rechazado, sin duplicados, marcado al liberarse, 2 de la lista pulsan "Confirmar" a la vez → gana 1, reservado).
- **Trampa:** no correr `next build` con el servidor de desarrollo abierto (comparten `.next`): la página recarga en bucle. Borrar `.next` y reiniciar.

## Decisiones de Joss (2026-11-14)
- **Versión completa, todo de una:** varios negocios con registro, roles dueño y profesional, recordatorio por correo y WhatsApp automático, y botón manual de WhatsApp. Nada se deja "para v2".
- **Todo lo gratis entra (2026-11-14):** varias sedes, lista de espera, anticipos en línea (Stripe en modo prueba), recordatorio 1 h antes (GitHub Actions cada 10 min, gratis por ser repo público) y panel de superadmin. Sin dominio propio: el correo de Resend solo llega al correo de Joss (es demo gratis). El WhatsApp automático usa el número de prueba de Meta (máximo 5 destinatarios verificados).
- **Demo:** barbería "Navaja Barber Club" (2 barberos, 5 servicios). Es una demo, no hay cliente real todavía.
- **Datos del cliente:** nombre y WhatsApp obligatorios, correo opcional.
- **Profesionales:** varios, cada uno con su horario. El cliente puede elegir "cualquiera".
- **Reglas de reserva configurables:**
  - anticipación de 2 h;
  - ventana de 30 días;
  - cancelar hasta 4 h antes;
  - intervalo de 15 o 30 min.
- **Deploy:** lo hace el orquestador con Vercel CLI, como en Ordenia. Joss solo inicia sesión.
- **Cuentas:** las crea el orquestador (Firebase, Vercel, Resend, Meta for Developers, Cloudinary existente). Joss solo hace los logins cuando se le abre el navegador.

## Cómo trabajar
- **Una ejecución a la vez,** verificada de punta a punta antes de seguir: probar el flujo real con Playwright, no solo compilar. Joss da la orden de cada una. Al cerrarla, actualiza la tabla de Estado.
- **Antes de escribir código,** lee `AGENTS.md` y la guía correspondiente en `node_modules/next/dist/docs/` (Next 16: `proxy.ts`, Cache Components, `PageProps<>`).
- **Firestore:** solo con el Admin SDK en el servidor.
  - Toda Server Action o ruta del panel empieza con `requireMember()`, que devuelve `{ uid, bizId, rol, staffId }`.
  - **Nunca** uses un `bizId` que venga del cliente.
- **Disponibilidad y reservas:**
  - Siempre se recalculan en el servidor.
  - La reserva crea los locks de 15 min con `create()` dentro de una transacción. Es lo que evita la doble reserva.
- **Fechas:** se guardan en UTC y se muestran con `Intl` en `America/Bogota`. No agregues librerías de fechas.
- **Pagos:** el webhook de Stripe es idempotente por id de evento; los anticipos retienen la hora 15 min.
- **Avisos:** son idempotentes, con un campo `avisos.*` por cita. Si el cron corre dos veces, no se envía nada repetido.
- **Interfaz:**
  - Primero móvil, con objetivos táctiles de 44 px o más.
  - Textos de la landing y de la página pública en lenguaje simple, sin jerga (regla de marca: se vende el problema).
- **Git:**
  - Los commits salen como `desarrojoss <322189278+desarrojoss@users.noreply.github.com>` (el `includeIf` del git global lo aplica dentro de `proyectos/`). Antes del primer commit, verifica `git config user.email`. Vercel bloquea los deploys de otros autores.
  - Commits pequeños en español, push a `origin main` al cerrar cada ejecución.
  - Si `git push` se cuelga, usa el comando con `gh` del CLAUDE.md raíz.
- **Secretos:** nunca commitees `.env.local`, service accounts ni claves, y las credenciales no pasan por el chat. Las variables se documentan en `.env.local.example`.
- **Al terminar** (ejecución 10):
  - DOCUMENTACION.md completa.
  - Card en `../Portafolio` con el estilo de Ordenia: logo y título a la izquierda, ventana de PC y teléfono con capturas reales, 1200x630. Commit y push del Portafolio.
  - Anotar el proyecto en el CLAUDE.md raíz.

## Relación con DesarroJoss
- La fábrica de contenido vive en `../../`.
- **Capturas reales:** `node ../../fabrica/render.mjs <url> captura.png` (móvil: `... captura.png 0 390 844`).
- **Pieza de bitácora:** solo cuando Joss la pida, en fin de semana. Mínimo 20 slides en modo Fotos, con música, contada en dos capas:
  - **Clientes:** "el cliente que reserva a las 11 de la noche mientras duermes".
  - **Programadores:** zonas horarias, doble reserva con locks, enlace con token, avisos idempotentes y errores contados.
  - Datos reales enmascarados en las capturas.
