# Agendia

Responde siempre en español. Proyecto de la marca DesarroJoss. Vive en `DesarroJoss/proyectos/Agendia`, pero es un **repo totalmente independiente**.
- **Repo:** `desarrojoss/Agendia` (rama `main`). **Público** (decidido: es parte del portafolio, y además hace gratis el cron de GitHub Actions).
- **Producción:** Vercel, equipo `desarro-joss`. La URL se anota aquí tras el primer deploy.

## Lee primero
- **[SPEC.md](SPEC.md):** alcance completo, modelo de datos, ejecuciones y límites. Es la fuente de verdad.
- Al cerrar la ejecución 10 se crea **DOCUMENTACION.md**, la referencia completa (como la de Ordenia). Desde entonces manda ese archivo.

## Estado
- **2026-11-14:** plan escrito, **pendiente de aprobación de Joss**. Todavía no hay repo, código ni cuentas creadas.
- **Siguiente:** cuando Joss diga "inicia", ejecución 0 (Base). 11 ejecuciones (0–10) en total.

| Ejecución | Estado |
|---|---|
| 0 Base | pendiente |
| 1 Negocios y acceso | pendiente |
| 2 Configuración | pendiente |
| 3 Motor de disponibilidad | pendiente |
| 4 Reserva pública | pendiente |
| 5 Gestionar sin cuenta y lista de espera | pendiente |
| 6 Pagos y anticipos (Stripe, prueba) | pendiente |
| 7 Panel | pendiente |
| 8 Avisos (correo + WhatsApp + cron) | pendiente |
| 9 Superadministrador | pendiente |
| 10 Demo y cierre | pendiente |

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
