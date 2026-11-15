# Agendia: especificación

Fuente de verdad del alcance y de las ejecuciones. Decidido con Joss el 2026-11-14 (ajustado el mismo día: todo lo gratis entra, repo público). **Estado: plan pendiente de aprobación.**
Regla de Joss: la versión es **completa, de inicio a fin**. No hay "v2" para lo que se acordó aquí.

## Qué es
Una plataforma de reservas en línea para negocios que trabajan con citas: barberías, salones, consultorios, psicólogos, entrenadores, tutores, estudios de fotos.
- Cada negocio se registra y recibe su página pública (`agendia.../<negocio>`).
- Sus clientes reservan solos, a cualquier hora, desde el celular.
- El dueño y su equipo ven la agenda, y los recordatorios salen solos.

## Para quién
- **Cliente del negocio:** quiere reservar sin esperar respuesta.
- **Dueño:** pierde citas por responder tarde, tiene citas dobles y gente que no llega, y lleva la agenda en un cuaderno o en el chat. Va desde el negocio pequeño hasta la pyme con varios profesionales.
- **Portafolio de DesarroJoss:** sirve de prueba real del carrusel del 2026-11-16 ("Las citas que pierdes por responder tarde").

## Alcance (todo en esta versión)

### 1. Plataforma, con varios negocios
- Landing de Agendia: qué resuelve (en lenguaje simple, sin jerga), cómo funciona, botones "Crea tu agenda gratis" y "Ver demo".
- Registro del dueño con correo y contraseña, y un asistente inicial con 4 pasos:
  1. Nombre y enlace (slug único).
  2. Servicios.
  3. Profesionales y horarios.
  4. Listo, con el enlace para compartir.
- Cada negocio tiene sus datos aislados. Todo acceso pasa por el servidor y valida a qué negocio pertenece el usuario.
- Roles:
  - **Dueño:** todo.
  - **Profesional:** ve y gestiona solo su agenda. Lo invita el dueño con su correo y entra con su propia cuenta.

### 2. Página pública de reserva (`/<slug>`, primero móvil)
- Encabezado del negocio: logo, nombre, dirección, WhatsApp e indicaciones.
- Flujo en 5 pasos:
  1. Servicio (duración y precio).
  2. Profesional, o "cualquiera".
  3. Día.
  4. Hora: solo las libres de verdad.
  5. Datos: nombre y WhatsApp obligatorios, correo opcional.
- Confirmación con:
  - botón "Agregar a mi calendario" (.ics);
  - mensaje de WhatsApp al negocio ya armado;
  - enlace privado para gestionar la cita.
- Con "cualquiera", el sistema asigna la cita al profesional libre con menos carga ese día.
- Reglas configurables por negocio:
  - anticipación mínima (por defecto 2 h);
  - ventana de reserva (por defecto 30 días);
  - límite para cancelar o reprogramar (por defecto 4 h antes);
  - intervalo entre horas (15 o 30 min);
  - tiempo de margen entre citas (opcional).

### 3. Gestionar la cita sin cuenta (`/cita/<token>`)
- El cliente ve su cita y puede cancelarla o reprogramarla dentro del límite. Pasado el límite, solo ve el botón "Escribir al negocio".
- El token es aleatorio y largo, y se guarda con hash.

### 4. Panel del negocio (`/panel`)
- **Agenda:** vista de día y de semana, filtrada por profesional, con colores por estado.
- **Estados de la cita:** confirmada → atendida / no llegó / cancelada (por el cliente o por el negocio).
- **Cita manual:** para quien llama o llega sin reserva. Usa las mismas reglas de disponibilidad.
- **Resumen:**
  - citas de hoy y de la semana;
  - ingresos estimados (citas atendidas × precio);
  - tasa de inasistencia;
  - servicios más pedidos;
  - ocupación por profesional.
- **Configuración:**
  - **Servicios:** crear, editar, ocultar, ordenar, con duración y precio en COP.
  - **Profesionales:** foto, servicios que atiende, horario semanal con pausas (por ejemplo, almuerzo), invitar por correo, desactivar.
  - **Bloqueos:** horas o días (vacaciones, festivos), por profesional o para todo el negocio.
  - **Negocio:** nombre, logo, slug, dirección, WhatsApp, reglas de reserva y mensajes.
- **Calendario externo:** cada profesional tiene un enlace de suscripción (ICS) para ver su agenda en Google Calendar o en el calendario del iPhone.

### 5. Avisos automáticos
- **Correo (Resend):**
  - confirmación al cliente (si dejó correo);
  - aviso de cita nueva, cancelada o reprogramada al dueño y al profesional;
  - recordatorio al cliente el día anterior.
- **WhatsApp automático (WhatsApp Cloud API de Meta):**
  - recordatorio del día anterior al cliente, con una plantilla aprobada;
  - aviso de cita nueva al negocio.
- **Botón manual** "Recordar por WhatsApp" en cada cita: abre `wa.me` con el mensaje ya armado. Sirve de respaldo.
- **Dos recordatorios por cita:** el día anterior y 1 hora antes (el negocio elige cuáles quiere).
- **Quién los dispara:**
  - Un workflow de **GitHub Actions cada 10 minutos** llama a `/api/cron/avisos` con un secreto. Es gratis e ilimitado porque el repo es público. Puede atrasarse unos minutos.
  - El cron diario de Vercel queda de respaldo.
- **Idempotente:** cada cita guarda qué avisos ya se enviaron, así que si dos disparadores coinciden no se envía nada repetido.

### 6. Sedes (varias por negocio)
- Un negocio puede tener varias sedes (nombre, dirección, WhatsApp opcional).
- Cada profesional y cada bloqueo pertenece a una sede, y los servicios se asignan a las sedes donde se ofrecen.
- Con una sola sede el flujo público no cambia. Con 2 o más, el primer paso es "¿en qué sede?".
- El panel filtra la agenda por sede.

### 7. Lista de espera
- Si un día no tiene horas libres, el cliente puede "Avisarme si se libera algo" (servicio, día, nombre, WhatsApp, correo opcional).
- Cuando se cancela una cita y se libera un hueco que encaja, se avisa a la lista de espera por correo y WhatsApp, con un enlace directo para reservar ese hueco. Gana quien reserve primero, porque el lock decide.
- El dueño ve la lista de espera en el panel.

### 8. Pagos y anticipos en línea (Stripe, modo prueba)
- Cada servicio puede exigir un anticipo (porcentaje o monto fijo) o ninguno.
- Con anticipo, la cita queda "pendiente de pago" y retiene la hora 15 minutos. Pasa a "confirmada" cuando el webhook de Stripe confirma el pago. Si no paga a tiempo, la hora se libera sola.
- El webhook es idempotente por id de evento. Se registra lo cobrado, y si la cita se cancela dentro del plazo se marca "a devolver" (el dueño devuelve desde Stripe).
- Es modo prueba (tarjeta 4242): demuestra el flujo completo sin mover dinero real. Para cobrar de verdad habría que activar la cuenta de Stripe o una pasarela local (Wompi, Mercado Pago), y eso no entra aquí.

### 9. Superadministrador (`/admin`)
- Solo para Joss (su uid va en una variable de entorno).
- Lista de negocios con fecha de registro, citas del mes y estado.
- Puede suspender o reactivar un negocio, y ver métricas globales (negocios, citas, avisos enviados).
- Botón para reiniciar la demo.

### 10. Demo
- Negocio de ejemplo: **barbería "Navaja Barber Club"**.
  - 2 sedes, 2 barberos por sede y 5 servicios (uno con anticipo): corte, barba, corte + barba, cejas, diseño.
  - Una semana de citas de ejemplo.
- Credenciales de demo visibles en el login del panel.
- Un cron nocturno restablece la demo desde la semilla. Los negocios reales registrados no se tocan.

## Fuera de alcance
Solo lo que cuesta dinero o es otra escala. Todo lo gratuito de la lista original entró:
- Cobros reales con dinero (la pasarela queda en modo prueba).
- Dominio propio para el correo y número propio verificado en WhatsApp (ver "Límites honestos").
- Aplicación móvil nativa y notificaciones push.
- Facturación electrónica.

## Stack
| Capa | Tecnología |
|---|---|
| Frontend y backend | Next.js 16 (App Router, Server Actions, Route Handlers) + TypeScript, un solo proyecto, como Ordenia |
| Estilos | Tailwind CSS v4, primero móvil |
| Datos | Firebase Firestore, solo con el Admin SDK en el servidor |
| Auth | Firebase Auth (correo y contraseña) + cookie de sesión verificada en el servidor (patrón de Quotia y Ordenia) |
| Imágenes | Cloudinary (la cuenta de Ordenia, en una carpeta `agendia/`), para logos y fotos de profesionales |
| Correo | Resend |
| Pagos | Stripe Checkout en modo prueba, con webhook (mismo patrón que Quotia) |
| Disparador de recordatorios | GitHub Actions cada 10 min (gratis, repo público) + cron diario de Vercel de respaldo |
| WhatsApp | WhatsApp Cloud API (Meta for Developers) |
| Fechas | `Intl` nativo con zona `America/Bogota`. Se guarda en UTC y se muestra en hora de Bogotá. Sin librerías de fechas |
| Pruebas | `node --test` para el motor de disponibilidad y las reglas, y Playwright para los flujos de punta a punta |
| Despliegue | Vercel, lo hace el orquestador con Vercel CLI (excepción, como Ordenia). Después, cada push a `main` despliega solo |

## Modelo de datos (Firestore)
- `businesses/{bizId}`: nombre, slug, logoUrl, direccion, whatsapp, zona (`America/Bogota`), reglas {anticipacionMin, ventanaDias, limiteCancelarMin, intervaloMin, margenMin}, creado, demo (bool).
- `slugs/{slug}`: { bizId }. Garantiza un slug único por transacción.
- `members/{uid}`: { bizId, rol: dueño | profesional, staffId? }.
- `businesses/{bizId}/services/{id}`: nombre, duracionMin, precio, activo, orden.
- `businesses/{bizId}/staff/{id}`: nombre, fotoUrl, email, uid?, servicios[], horario {lun..dom: [[inicio, fin], ...]}, activo, icsToken.
- `businesses/{bizId}/blocks/{id}`: staffId | null (todo el negocio), inicio, fin, motivo.
- `businesses/{bizId}/appointments/{id}`: serviceId, staffId, inicio, fin (UTC), cliente {nombre, whatsapp, email?}, precio, estado, origen (web | manual), tokenHash, avisos {confirmacion, recordatorioEmail, recordatorioWa, ...}, creado.
- `businesses/{bizId}/locks/{staffId_yyyymmdd_HHmm}`: un documento por bloque de 15 min ocupado. Se crean con `create()` dentro de la transacción de la reserva: si dos personas reservan la misma hora a la vez, solo una gana. Se borran al cancelar o reprogramar.

## Ejecuciones (cada una verificada de punta a punta antes de pasar a la siguiente; Joss da la orden de cada una)
| # | Ejecución | Queda funcionando |
|---|---|---|
| 0 | Base | Repo público `desarrojoss/Agendia`, Next 16 + Tailwind, proyecto de Firebase nuevo (Firestore + Auth), proyecto en Vercel enlazado, `.env.local.example`, primer deploy "hola mundo" |
| 1 | Negocios y acceso | Registro del dueño, asistente paso 1 (nombre y slug), login, cookie de sesión, `proxy.ts`, `requireMember()`, roles, aislamiento por negocio |
| 2 | Configuración | Sedes, servicios (con anticipo opcional), profesionales con horarios y pausas, bloqueos, datos del negocio, reglas, logo y fotos (Cloudinary), asistente completo |
| 3 | Motor de disponibilidad | Función pura de horas libres (sede, horario, pausas, duración, margen, bloqueos, citas, anticipación, ventana, zona de Bogotá) con pruebas `node --test` |
| 4 | Reserva pública | `/<slug>` con el flujo (sede si hay varias), "cualquiera", reserva con locks en transacción, confirmación, .ics y WhatsApp armado. Probado con dos reservas simultáneas |
| 5 | Gestionar sin cuenta y lista de espera | `/cita/<token>`: ver, cancelar y reprogramar con límite. Lista de espera: alta del cliente y aviso al liberarse un hueco |
| 6 | Pagos y anticipos | Stripe Checkout en modo prueba, cita "pendiente de pago" con retención de 15 min, webhook idempotente, expiración automática, marca "a devolver" |
| 7 | Panel | Agenda de día y semana por sede y profesional, estados, cita manual, resumen con métricas, rol profesional (solo su agenda), invitación por correo, feed ICS por profesional, vista de lista de espera |
| 8 | Avisos | Resend (confirmación, avisos al negocio, recordatorios), WhatsApp Cloud API (plantillas), botón manual, recordatorio del día anterior y 1 h antes, GitHub Actions cada 10 min + cron de respaldo, todo idempotente |
| 9 | Superadministrador | `/admin` para Joss: negocios, suspender o reactivar, métricas globales, reinicio de la demo |
| 10 | Demo y cierre | Semilla "Navaja Barber Club" (con 2 sedes para mostrar esa función), reinicio nocturno, landing, pulido de móvil y PC, accesibilidad, deploy a producción, README, DOCUMENTACION.md, card en el Portafolio (estilo Ordenia) y capturas reales |

## Cuentas y servicios (los crea el orquestador; Joss solo inicia sesión cuando se abre el navegador)
- **GitHub:** `desarrojoss/Agendia` (ya conectado con `gh`).
- **Firebase:** proyecto nuevo con la cuenta `desarrojoss` (Firestore + Auth).
- **Vercel:** equipo `desarro-joss`.
- **Stripe:** cuenta de pruebas (la de Quotia o una nueva); claves de prueba y endpoint de webhook.
- **Cloudinary:** la cuenta existente de Ordenia.
- **Resend:** cuenta nueva.
- **Meta for Developers:** app con WhatsApp, número de prueba y el número de Joss como destinatario verificado.

Las credenciales van a `.env.local` y a las variables de Vercel. Nunca al chat ni al repo.

## Límites honestos (conocidos desde ya)
- **Correo sin dominio propio:** Resend en modo prueba solo envía al correo del dueño de la cuenta. Para que le llegue a cualquier cliente hace falta un dominio verificado (unos USD 10 al año).
- **WhatsApp con el número de prueba de Meta:** solo envía a números verificados (máximo 5) y con plantillas aprobadas. Para clientes reales hace falta un número propio y verificar el negocio en Meta. En producción puede haber costo por mensaje.
- **Disparador de recordatorios:** GitHub Actions no garantiza la hora exacta (puede atrasarse unos minutos). El recordatorio de "1 hora antes" llega "alrededor de" esa hora.
- **Pagos:** son de prueba. Nadie paga de verdad.
