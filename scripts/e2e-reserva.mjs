// Prueba de punta a punta de la ejecución 4: reserva pública, confirmación, .ics, WhatsApp y, sobre todo, que dos
// clientes NUNCA se queden con la misma hora aunque pulsen "Confirmar" a la vez.
// Uso: BASE_URL=http://localhost:3100 node scripts/e2e-reserva.mjs   (necesita .env.local; borra todo lo que crea)
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const sa = JSON.parse(Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString());
const db = getFirestore(initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }) }));

const id = Date.now().toString(36);
let fallos = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallos++;
};

// Fechas en Bogotá (UTC-5, sin horario de verano)
const hoyBogota = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
const sumar = (f, n) => new Date(Date.parse(`${f}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
const dow = (f) => new Date(`${f}T00:00:00Z`).getUTCDay();
const utc = (fecha, hora) => Date.parse(`${fecha}T${hora}:00Z`) + 5 * 3600_000;
let FECHA = sumar(hoyBogota(), 2);
while (dow(FECHA) !== 3) FECHA = sumar(FECHA, 1); // un miércoles, al menos 2 días adelante

const negocios = [];
async function sembrar({ nombre, sedes, servicios, personal, whatsapp = "573001112233" }) {
  const slug = `reserva-${nombre}-${id}`;
  const ref = db.collection("businesses").doc();
  await ref.set({ nombre: `Negocio ${nombre} ${id}`, slug, logoUrl: null, direccion: "Calle 1 # 2-3", whatsapp, zona: "America/Bogota", demo: false, suspendido: false, ownerUid: "x", creado: Date.now(),
    reglas: { anticipacionMin: 120, ventanaDias: 30, limiteCancelarMin: 240, intervaloMin: 30, margenMin: 0 } });
  await db.collection("slugs").doc(slug).set({ bizId: ref.id });
  negocios.push(ref.id);
  const sedeIds = [];
  for (const [i, s] of sedes.entries()) sedeIds.push((await ref.collection("locations").add({ ...s, whatsapp: "", activo: true, orden: i })).id);
  const servIds = [];
  for (const [i, s] of servicios.entries()) servIds.push((await ref.collection("services").add({ descripcion: "", activo: true, orden: i, anticipo: { tipo: "ninguno" }, ...s, sedes: s.sedes.map((k) => sedeIds[k]) })).id);
  const dia = [["09:00", "13:00"], ["14:00", "18:00"]];
  const horario = { lun: dia, mar: dia, mie: dia, jue: dia, vie: dia, sab: dia, dom: [] };
  const staffIds = [];
  for (const p of personal) staffIds.push((await ref.collection("staff").add({ nombre: p.nombre, fotoUrl: null, email: "", uid: null, sedeId: sedeIds[p.sede], servicios: p.servicios.map((k) => servIds[k]), horario, activo: true, icsToken: "x".repeat(32) })).id);
  return { slug, biz: ref.id, ref, sedeIds, servIds, staffIds };
}

const huecoVisible = (page, h) => page.locator(`[data-hora="${h}"]`).waitFor({ timeout: 15000 }).then(() => true, () => false);

// Toca el día de la prueba y espera a que sus horas estén cargadas (el chip queda "presionado" cuando termina de cargar).
async function elegirDia(page) {
  await page.locator(`[data-fecha="${FECHA}"]`).click({ timeout: 15000 });
  await page.locator(`[data-fecha="${FECHA}"][aria-pressed="true"]`).waitFor({ timeout: 15000 });
}

async function llegarAlFormulario(browser, slug, { servicio, persona, hora, nombre, whatsapp }) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage();
  await page.goto(`${BASE}/${slug}`);
  await page.getByRole("button", { name: servicio }).click();
  if (persona) await page.getByRole("button", { name: persona }).click();
  await elegirDia(page);
  await page.locator(`[data-hora="${hora}"]`).click({ timeout: 15000 });
  await page.getByLabel("Tu nombre").fill(nombre);
  await page.getByLabel("Tu WhatsApp").fill(whatsapp);
  return page;
}

async function resultado(page) {
  const ganador = page.waitForURL(/\/cita\//, { timeout: 25000 }).then(() => "ok", () => null);
  // ojo: Next pone su propio role="alert" (anunciador de rutas); el aviso de la reserva es un <p role="alert">
  const perdedor = page.locator('p[role="alert"]').first().waitFor({ timeout: 25000 }).then(async () => "error", () => null);
  return Promise.race([ganador, perdedor]);
}

const browser = await chromium.launch();
try {
  // ---------- Negocio 1: una sede, dos profesionales ----------
  const n1 = await sembrar({
    nombre: "uno",
    sedes: [{ nombre: "Principal", direccion: "Cra 45 # 70-20" }],
    servicios: [{ nombre: "Corte clásico", duracionMin: 30, precio: 25000, sedes: [0] }, { nombre: "Afeitado premium", duracionMin: 30, precio: 40000, anticipo: { tipo: "porcentaje", valor: 30 }, sedes: [0] }],
    personal: [{ nombre: "Luis", sede: 0, servicios: [0, 1] }, { nombre: "Ana", sede: 0, servicios: [0, 1] }],
  });
  const [luis] = n1.staffIds;

  // 1. Flujo completo de un cliente
  let p = await llegarAlFormulario(browser, n1.slug, { servicio: /Corte clásico/, persona: /Luis/, hora: "10:00", nombre: "Cliente Uno", whatsapp: "300 111 0001" });
  ok(!(await p.getByText("¿En qué sede?").count()), "con una sola sede, el cliente no ve el paso de sedes");
  if (process.env.SHOT) await p.screenshot({ path: `${process.env.SHOT}-form.png`, fullPage: true });
  await p.getByRole("button", { name: "Confirmar reserva" }).click();
  await p.waitForURL(/\/cita\/[\w-]+\?nueva=1/, { timeout: 25000 });
  const token = new URL(p.url()).pathname.split("/").pop();
  if (process.env.SHOT) await p.screenshot({ path: `${process.env.SHOT}-cita.png`, fullPage: true });
  ok(await p.getByText("¡Listo, Cliente!").isVisible() && await p.getByText("Confirmada").isVisible(), "tras reservar llega a su página de cita: ¡Listo! y Confirmada");
  ok((await p.content()).includes("Corte clásico") && (await p.content()).includes("Luis"), "la cita muestra servicio y profesional");

  const citas = (await n1.ref.collection("appointments").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const cita = citas[0];
  ok(citas.length === 1 && cita.estado === "confirmada" && cita.inicio === utc(FECHA, "10:00") && cita.fin === utc(FECHA, "10:30") && cita.staffId === luis, "la cita queda confirmada con la hora exacta de Bogotá en UTC");
  ok(cita.cliente.whatsapp === "573001110001", "el WhatsApp del cliente se guarda con indicativo");
  const locks = (await n1.ref.collection("locks").get()).docs;
  ok(locks.length === 6 && locks.every((l) => l.data().citaId === cita.id && l.id.startsWith(`${luis}_`)), "se crean 6 candados de 5 minutos para la cita de 30 minutos");
  const hash = createHash("sha256").update(token).digest("hex");
  const tdoc = await db.collection("citaTokens").doc(hash).get();
  ok(tdoc.exists && tdoc.data().citaId === cita.id, "el enlace privado se guarda solo como hash");
  ok(!JSON.stringify(cita).includes(token), "el token real no se guarda en la cita");

  // 2. .ics y WhatsApp
  const ics = await fetch(`${BASE}/cita/${token}/calendario.ics`);
  const icsTexto = await ics.text();
  ok(ics.headers.get("content-type")?.includes("text/calendar") && icsTexto.includes("DTSTART:" + new Date(utc(FECHA, "10:00")).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")) && icsTexto.includes("SUMMARY:Corte clásico en Negocio uno"), "el .ics trae la hora correcta y el resumen");
  const wa = await p.getByRole("link", { name: /WhatsApp/ }).getAttribute("href");
  ok(wa?.startsWith("https://wa.me/573001112233?text=") && decodeURIComponent(wa).includes("Corte clásico"), "el botón de WhatsApp apunta al número del negocio con el mensaje armado");
  ok((await fetch(`${BASE}/cita/token-que-no-existe`)).status === 404, "un enlace de cita inventado da 404");

  // 3. La hora reservada ya no se ofrece
  p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage();
  await p.goto(`${BASE}/${n1.slug}`);
  await p.getByRole("button", { name: /Corte clásico/ }).click();
  await p.getByRole("button", { name: /Luis/ }).click();
  await elegirDia(p);
  ok((await huecoVisible(p, "09:30")) && !(await p.locator('[data-hora="10:00"]').count()), "a Luis ya no se le ofrece la hora reservada (10:00), y sí la anterior (09:30)");

  // 4. Validaciones del formulario
  p = await llegarAlFormulario(browser, n1.slug, { servicio: /Corte clásico/, persona: /Ana/, hora: "09:00", nombre: "Cliente Malo", whatsapp: "12" });
  await p.getByRole("button", { name: "Confirmar reserva" }).click();
  ok(await p.getByText("Revisa tu WhatsApp").waitFor({ timeout: 10000 }).then(() => true, () => false), "un WhatsApp inválido se rechaza con un mensaje claro");
  await p.locator('input[tabindex="-1"]').fill("soy un bot", { force: true });
  await p.getByLabel("Tu WhatsApp").fill("300 111 0002");
  await p.getByRole("button", { name: "Confirmar reserva" }).click();
  ok(await p.getByText("No pudimos completar la reserva").waitFor({ timeout: 10000 }).then(() => true, () => false), "el campo trampa de los bots rechaza la reserva");
  ok((await n1.ref.collection("appointments").get()).size === 1, "ninguna de las dos reservas inválidas dejó una cita");

  // 5. Servicio con anticipo: queda pendiente de pago y retiene la hora
  p = await llegarAlFormulario(browser, n1.slug, { servicio: /Afeitado premium/, persona: /Ana/, hora: "11:00", nombre: "Cliente Anticipo", whatsapp: "300 111 0003" });
  ok(await p.getByText("pide un anticipo de").isVisible(), "un servicio con anticipo avisa cuánto y que la hora se retiene");
  await p.getByRole("button", { name: "Confirmar reserva" }).click();
  await p.waitForURL(/\/cita\//, { timeout: 25000 });
  ok(await p.getByText("Falta pagar el anticipo").first().isVisible(), "la cita con anticipo queda 'pendiente de pago'");
  const pend = (await n1.ref.collection("appointments").where("estado", "==", "pendiente_pago").get()).docs[0]?.data();
  ok(pend?.anticipo === 12000 && Math.abs(pend.retieneHasta - Date.now() - 15 * 60_000) < 60_000 // margen de 1 min por diferencias de reloj con el servidor, "el anticipo es el 30% (12.000) y la hora se retiene 15 minutos");

  // 6. Hora que se ocupa mientras el cliente llena sus datos
  p = await llegarAlFormulario(browser, n1.slug, { servicio: /Corte clásico/, persona: /Luis/, hora: "16:00", nombre: "Cliente Tarde", whatsapp: "300 111 0004" });
  await n1.ref.collection("appointments").add({ staffId: luis, servicioId: n1.servIds[0], inicio: utc(FECHA, "16:00"), fin: utc(FECHA, "16:30"), estado: "confirmada", cliente: { nombre: "Otro", whatsapp: "573009999999", email: "" } });
  await p.getByRole("button", { name: "Confirmar reserva" }).click();
  ok(await p.getByText("Esa hora ya no está disponible").waitFor({ timeout: 15000 }).then(() => true, () => false), "si alguien se gana la hora, el cliente recibe un aviso claro");
  ok(await p.locator('[data-hora="16:00"]').waitFor({ state: "detached", timeout: 15000 }).then(() => true, () => false) && (await p.locator('[data-hora="16:30"]').count()) === 1, "y las horas se refrescan sin la que se ocupó");

  // 7. Límite de citas abiertas por WhatsApp (3)
  for (const hora of ["12:00", "12:30"]) {
    const q = await llegarAlFormulario(browser, n1.slug, { servicio: /Corte clásico/, persona: /Luis/, hora, nombre: "Cliente Uno", whatsapp: "300 111 0001" });
    await q.getByRole("button", { name: "Confirmar reserva" }).click();
    await q.waitForURL(/\/cita\//, { timeout: 25000 });
  }
  const q4 = await llegarAlFormulario(browser, n1.slug, { servicio: /Corte clásico/, persona: /Luis/, hora: "14:00", nombre: "Cliente Uno", whatsapp: "300 111 0001" });
  await q4.getByRole("button", { name: "Confirmar reserva" }).click();
  ok(await q4.getByText("Ya tienes 3 citas pendientes").waitFor({ timeout: 15000 }).then(() => true, () => false), "un mismo WhatsApp no puede acumular más de 3 citas abiertas");

  // ---------- Concurrencia 1: varios clientes, la MISMA hora, el MISMO profesional ----------
  for (const hora of ["17:00", "14:30", "15:00"]) {
    const N = 4;
    const paginas = [];
    for (let i = 0; i < N; i++) paginas.push(await llegarAlFormulario(browser, n1.slug, { servicio: /Corte clásico/, persona: /Luis/, hora, nombre: `Corredor ${i}`, whatsapp: `30022${i}${hora.replace(":", "")}` }));
    await Promise.all(paginas.map((pg) => pg.getByRole("button", { name: "Confirmar reserva" }).click()));
    const res = await Promise.all(paginas.map(resultado));
    if (process.env.DEBUG_E2E) {
      await paginas[0].waitForTimeout(4000);
      for (const [k, pg] of paginas.entries()) console.log(`   · p${k}`, pg.url().slice(-28), "| alertas:", (await pg.getByRole("alert").allTextContents()).join("|"), "| boton:", await pg.getByRole("button", { name: /Reserv|Confirmar/ }).last().textContent({ timeout: 1000 }).catch(() => "-"), "| resultado:", res[k]);
    }
    const ganadores = res.filter((r) => r === "ok").length;
    const enBase = (await n1.ref.collection("appointments").where("inicio", "==", utc(FECHA, hora)).where("staffId", "==", luis).get()).size;
    ok(ganadores === 1 && enBase === 1, `${N} clientes pulsan Confirmar a la vez por Luis a las ${hora}: gana 1 y la base tiene 1 cita (ganadores: ${ganadores}, en la base: ${enBase})`);
    ok(paginas.filter((_, i) => res[i] === "error").length === N - 1, "los demás reciben un aviso en vez de una cita");
  }

  // ---------- Concurrencia 2: "cualquiera" con 2 profesionales y 3 clientes ----------
  {
    const hora = "11:30";
    const paginas = [];
    for (let i = 0; i < 3; i++) paginas.push(await llegarAlFormulario(browser, n1.slug, { servicio: /Corte clásico/, persona: /^Cualquiera/, hora, nombre: `Cualquiera ${i}`, whatsapp: `300 333 100${i}` }));
    await Promise.all(paginas.map((pg) => pg.getByRole("button", { name: "Confirmar reserva" }).click()));
    const res = await Promise.all(paginas.map(resultado));
    const docs = (await n1.ref.collection("appointments").where("inicio", "==", utc(FECHA, hora)).get()).docs.map((d) => d.data());
    ok(res.filter((r) => r === "ok").length === 2 && docs.length === 2 && new Set(docs.map((d) => d.staffId)).size === 2, "3 clientes con 'cualquiera' y 2 profesionales: 2 reservan (uno con cada uno) y el tercero recibe aviso");
  }

  // ---------- Negocio 2: dos sedes ----------
  const n2 = await sembrar({
    nombre: "dos",
    sedes: [{ nombre: "Sede Centro", direccion: "Centro" }, { nombre: "Sede Norte", direccion: "Norte" }],
    servicios: [{ nombre: "Servicio centro", duracionMin: 30, precio: 20000, sedes: [0] }, { nombre: "Servicio norte", duracionMin: 60, precio: 35000, sedes: [1] }],
    personal: [{ nombre: "Pedro", sede: 0, servicios: [0] }, { nombre: "María", sede: 1, servicios: [1] }],
  });
  p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage();
  await p.goto(`${BASE}/${n2.slug}`);
  ok(await p.getByRole("button", { name: /Sede Centro/ }).isVisible() && await p.getByRole("button", { name: /Sede Norte/ }).isVisible(), "con 2 sedes, el primer paso es elegir la sede");
  await p.getByRole("button", { name: /Sede Norte/ }).click();
  ok(await p.getByRole("button", { name: /Servicio norte/ }).isVisible() && !(await p.getByRole("button", { name: /Servicio centro/ }).count()), "solo se ofrecen los servicios de la sede elegida");
  await p.getByRole("button", { name: /Servicio norte/ }).click();
  ok(!(await p.getByText("¿Con quién?").count()) && (await p.locator("[data-fecha]").first().waitFor({ timeout: 15000 }).then(() => true, () => false)), "con un solo profesional, se salta el paso '¿Con quién?' y muestra las horas");
  await elegirDia(p);
  await p.locator('[data-hora="09:00"]').click();
  await p.getByLabel("Tu nombre").fill("Cliente Norte");
  await p.getByLabel("Tu WhatsApp").fill("300 444 0001");
  await p.getByRole("button", { name: "Confirmar reserva" }).click();
  await p.waitForURL(/\/cita\//, { timeout: 25000 });
  const c2 = (await n2.ref.collection("appointments").get()).docs[0]?.data();
  ok(c2?.sedeNombre === "Sede Norte" && c2.staffNombre === "María" && c2.fin - c2.inicio === 3600_000 && (await p.getByText("Sede Norte").first().isVisible()), "la cita queda en la sede elegida, con su profesional y duración (60 min)");

  // ---------- Negocios inexistentes o suspendidos ----------
  ok((await fetch(`${BASE}/no-existe-${id}`)).status === 404, "un enlace inexistente da 404");
  await n2.ref.update({ suspendido: true });
  ok((await fetch(`${BASE}/${n2.slug}`)).status === 404, "un negocio suspendido no existe para el público");
} catch (e) {
  console.error("✗ error inesperado:", e.message);
  fallos++;
} finally {
  await browser.close();
  for (const biz of negocios) {
    try {
      await db.recursiveDelete(db.collection("businesses").doc(biz));
      for (const s of (await db.collection("slugs").where("bizId", "==", biz).get()).docs) await s.ref.delete();
      for (const t of (await db.collection("citaTokens").where("bizId", "==", biz).get()).docs) await t.ref.delete();
    } catch (e) {
      console.error("limpieza", e.message);
    }
  }
}
console.log(fallos ? `\n${fallos} fallo(s)` : "\nTodo bien");
process.exit(fallos ? 1 : 0);
