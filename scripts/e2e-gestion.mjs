// Prueba de punta a punta de la ejecución 5: el cliente cancela y cambia la hora de su cita SIN cuenta (con el enlace
// privado), el límite de horas, y la lista de espera (alta, aviso al liberarse un hueco y reserva de ese hueco).
// Uso: BASE_URL=http://localhost:3100 node scripts/e2e-gestion.mjs   (necesita .env.local; borra todo lo que crea)
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

const hoyBogota = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
const sumar = (f, n) => new Date(Date.parse(`${f}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
const dow = (f) => new Date(`${f}T00:00:00Z`).getUTCDay();
const utc = (fecha, hora) => Date.parse(`${fecha}T${hora}:00Z`) + 5 * 3600_000;
let FECHA = sumar(hoyBogota(), 2);
while (dow(FECHA) !== 3) FECHA = sumar(FECHA, 1); // un miércoles, al menos 2 días adelante
const FECHA2 = sumar(FECHA, 1); // el jueves

const negocios = [];
async function sembrar({ nombre, servicios, horario }) {
  const slug = `gestion-${nombre}-${id}`;
  const ref = db.collection("businesses").doc();
  await ref.set({ nombre: `Negocio ${nombre} ${id}`, slug, logoUrl: null, direccion: "Calle 1 # 2-3", whatsapp: "573001112233", zona: "America/Bogota", demo: false, suspendido: false, ownerUid: "x", creado: Date.now(),
    reglas: { anticipacionMin: 120, ventanaDias: 30, limiteCancelarMin: 240, intervaloMin: 30, margenMin: 0 } });
  await db.collection("slugs").doc(slug).set({ bizId: ref.id });
  negocios.push(ref.id);
  const sede = (await ref.collection("locations").add({ nombre: "Principal", direccion: "Cra 45 # 70-20", whatsapp: "", activo: true, orden: 0 })).id;
  const servIds = [];
  for (const [i, s] of servicios.entries()) servIds.push((await ref.collection("services").add({ descripcion: "", activo: true, orden: i, anticipo: { tipo: "ninguno" }, ...s, sedes: [sede] })).id);
  const staff = (await ref.collection("staff").add({ nombre: "Luis", fotoUrl: null, email: "", uid: null, sedeId: sede, servicios: servIds, horario, activo: true, icsToken: "x".repeat(32) })).id;
  return { slug, biz: ref.id, ref, sede, servIds, staff, servNombres: servicios.map((s) => s.nombre) };
}

/** Siembra una cita ya hecha (como si el cliente hubiera reservado) con sus candados y su enlace privado. */
async function sembrarCita(n, { serv = 0, inicio, duracionMin = 30, estado = "confirmada", whatsapp, nombre = "Cliente", retieneHasta }) {
  const token = `tok-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  const fin = inicio + duracionMin * 60_000;
  const ref = n.ref.collection("appointments").doc();
  await ref.set({ servicioId: n.servIds[serv], servicioNombre: n.servNombres[serv], precio: 25000, duracionMin, anticipo: 0, staffId: n.staff, staffNombre: "Luis", sedeId: n.sede, sedeNombre: "Principal",
    inicio, fin, cliente: { nombre, whatsapp, email: "" }, estado, ...(retieneHasta ? { retieneHasta } : {}), origen: "web", avisos: {}, creado: Date.now() });
  for (let t = Math.floor(inicio / 300_000); t * 300_000 < fin; t++) await n.ref.collection("locks").doc(`${n.staff}_${t}`).set({ citaId: ref.id, staffId: n.staff });
  await db.collection("citaTokens").doc(createHash("sha256").update(token).digest("hex")).set({ bizId: n.biz, citaId: ref.id, creado: Date.now() });
  return { token, id: ref.id, ref };
}

const nuevaPagina = async (browser) => (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage();
async function elegirDia(page, fecha = FECHA) {
  await page.locator(`[data-fecha="${fecha}"]`).click({ timeout: 15000 });
  await page.locator(`[data-fecha="${fecha}"][aria-pressed="true"]`).waitFor({ timeout: 15000 });
}
const hay = (page, sel) => page.locator(sel).waitFor({ timeout: 15000 }).then(() => true, () => false);
// gana quien llega a la URL; pierde quien ve el aviso de error (ojo: Next pone su propio role="alert", el de la app es <p>)
const resultado = (pg, url) => {
  const g = pg.waitForURL(url, { timeout: 25000 }).then(() => "ok", () => null);
  const e = pg.locator('p[role="alert"]').first().waitFor({ timeout: 25000 }).then(() => "error", () => null);
  return Promise.race([g, e]);
};

const browser = await chromium.launch();
try {
  // ---------- Negocio A: citas de 30 y de 60 min, Luis de 9 a 13 y de 14 a 18 ----------
  const dia = [["09:00", "13:00"], ["14:00", "18:00"]];
  const A = await sembrar({
    nombre: "a",
    servicios: [{ nombre: "Corte clásico", duracionMin: 30, precio: 25000 }, { nombre: "Corte y barba", duracionMin: 60, precio: 40000 }],
    horario: { lun: dia, mar: dia, mie: dia, jue: dia, vie: dia, sab: dia, dom: [] },
  });

  // 1. Reprogramar: 10:00 → 14:00
  let c = await sembrarCita(A, { inicio: utc(FECHA, "10:00"), whatsapp: "573100000001", nombre: "Ana Mover" });
  let p = await nuevaPagina(browser);
  await p.goto(`${BASE}/cita/${c.token}`);
  ok((await p.getByRole("link", { name: "Cambiar el día o la hora" }).isVisible()) && (await p.getByRole("button", { name: "Cancelar mi cita" }).isVisible()), "con tiempo de sobra, la cita ofrece cambiar y cancelar");
  if (process.env.SHOT) await p.screenshot({ path: `${process.env.SHOT}-gestion.png`, fullPage: true });
  await p.getByRole("link", { name: "Cambiar el día o la hora" }).click();
  await p.waitForURL(/reprogramar/);
  await elegirDia(p);
  ok((await hay(p, '[data-hora="14:00"]')) && (await p.locator('[data-hora="10:00"]').count()) === 1, "al cambiar, la hora actual de la cita sí se ofrece (la cita no se estorba a sí misma)");
  if (process.env.SHOT) await p.screenshot({ path: `${process.env.SHOT}-reprogramar.png`, fullPage: true });
  await p.locator('[data-hora="14:00"]').click();
  await p.getByRole("button", { name: "Confirmar el cambio" }).click();
  await p.waitForURL(/\?movida=1/, { timeout: 25000 });
  ok(await p.getByText("cambiamos tu hora").isVisible(), "tras confirmar vuelve a su cita con el aviso de cambio");
  let d = (await c.ref.get()).data();
  ok(d.inicio === utc(FECHA, "14:00") && d.fin === utc(FECHA, "14:30") && d.inicioAnterior === utc(FECHA, "10:00") && d.estado === "confirmada", "la cita queda a las 14:00 (hora de Bogotá en UTC), confirmada, y recuerda la hora anterior");
  let locks = (await A.ref.collection("locks").get()).docs;
  ok(locks.length === 6 && locks.every((l) => l.data().citaId === c.id && Number(l.id.split("_")[1]) >= Math.floor(utc(FECHA, "14:00") / 300_000)), "los candados viejos se soltaron y hay 6 nuevos: la hora de las 10:00 quedó libre");

  // 2. Cambiar una cita de 60 min a media hora después (el horario nuevo se cruza con el viejo)
  c = await sembrarCita(A, { serv: 1, duracionMin: 60, inicio: utc(FECHA, "15:00"), whatsapp: "573100000002", nombre: "Beto Cruce" });
  p = await nuevaPagina(browser);
  await p.goto(`${BASE}/cita/${c.token}/reprogramar`);
  await elegirDia(p);
  await p.locator('[data-hora="15:30"]').click({ timeout: 15000 });
  await p.getByRole("button", { name: "Confirmar el cambio" }).click();
  await p.waitForURL(/\?movida=1/, { timeout: 25000 });
  d = (await c.ref.get()).data();
  locks = (await A.ref.collection("locks").where("citaId", "==", c.id).get()).docs;
  ok(d.inicio === utc(FECHA, "15:30") && d.fin === utc(FECHA, "16:30") && locks.length === 12, "mover una cita de 60 min a +30 min (cruzándose consigo misma) funciona y deja 12 candados exactos");

  // 3. Dos clientes cambian su cita a la MISMA hora a la vez: solo uno gana
  const c1 = await sembrarCita(A, { inicio: utc(FECHA, "09:00"), whatsapp: "573100000003", nombre: "Carla Carrera" });
  const c2 = await sembrarCita(A, { inicio: utc(FECHA, "09:30"), whatsapp: "573100000004", nombre: "Dani Carrera" });
  const paginas = [];
  for (const cc of [c1, c2]) {
    const pg = await nuevaPagina(browser);
    await pg.goto(`${BASE}/cita/${cc.token}/reprogramar`);
    await elegirDia(pg);
    await pg.locator('[data-hora="17:00"]').click({ timeout: 15000 });
    paginas.push(pg);
  }
  await Promise.all(paginas.map((pg) => pg.getByRole("button", { name: "Confirmar el cambio" }).click()));
  const res = await Promise.all(paginas.map((pg) => resultado(pg, /\?movida=1/)));
  const a17 = (await A.ref.collection("appointments").where("inicio", "==", utc(FECHA, "17:00")).get()).size;
  ok(res.filter((x) => x === "ok").length === 1 && res.filter((x) => x === "error").length === 1 && a17 === 1, `dos cambios a la misma hora a la vez: gana exactamente 1 (resultados: ${res.join(", ")}; citas a las 17:00: ${a17})`);

  // 4. Cancelar con confirmación, y la hora vuelve a ofrecerse y se puede reservar de nuevo
  c = await sembrarCita(A, { inicio: utc(FECHA, "11:00"), whatsapp: "573100000005", nombre: "Eva Cancela" });
  p = await nuevaPagina(browser);
  await p.goto(`${BASE}/cita/${c.token}`);
  await p.getByRole("button", { name: "Cancelar mi cita" }).click();
  ok(await p.getByText("¿Seguro que quieres cancelar").isVisible(), "cancelar pide una confirmación antes de hacerlo");
  await p.getByRole("button", { name: "No, volver" }).click();
  ok((await c.ref.get()).data().estado === "confirmada", "'No, volver' no cancela nada");
  await p.getByRole("button", { name: "Cancelar mi cita" }).click();
  await p.getByRole("button", { name: "Sí, cancelar" }).click();
  await p.getByText("Cancelaste esta cita").waitFor({ timeout: 15000 });
  d = (await c.ref.get()).data();
  ok(d.estado === "cancelada" && d.canceladaPor === "cliente" && (await p.getByText("Cancelada", { exact: true }).isVisible()), "la cita queda cancelada (por el cliente) y la página lo muestra");
  ok(!(await p.getByRole("button", { name: "Cancelar mi cita" }).count()) && !(await p.getByRole("link", { name: "Cambiar el día o la hora" }).count()), "una cita cancelada ya no ofrece cancelar ni cambiar");
  p = await nuevaPagina(browser);
  await p.goto(`${BASE}/${A.slug}`);
  await p.getByRole("button", { name: /Corte clásico/ }).click();
  await elegirDia(p);
  ok(await hay(p, '[data-hora="11:00"]'), "la hora cancelada (11:00) vuelve a ofrecerse");
  await p.locator('[data-hora="11:00"]').click();
  await p.getByLabel("Tu nombre").fill("Fabio Nuevo");
  await p.getByLabel("Tu WhatsApp").fill("300 000 0006");
  await p.getByRole("button", { name: "Confirmar reserva" }).click();
  await p.waitForURL(/\/cita\//, { timeout: 25000 });
  ok((await A.ref.collection("appointments").where("inicio", "==", utc(FECHA, "11:00")).where("estado", "==", "confirmada").get()).size === 1, "otro cliente reserva esa hora liberada (el candado viejo se sobrescribe)");

  // 5. Pasado el límite: solo "Escribir al negocio"; no se puede forzar entrando a /reprogramar
  const en2h = Math.ceil((Date.now() + 2 * 3600_000) / 300_000) * 300_000;
  c = await sembrarCita(A, { inicio: en2h, whatsapp: "573100000007", nombre: "Gus Tarde" });
  p = await nuevaPagina(browser);
  await p.goto(`${BASE}/cita/${c.token}`);
  const escribir = p.getByRole("link", { name: "Escribir al negocio" });
  ok((await escribir.isVisible()) && !(await p.getByRole("button", { name: "Cancelar mi cita" }).count()) && !(await p.getByRole("link", { name: "Cambiar el día o la hora" }).count()), "a 2 horas de la cita (límite 4 h) solo queda 'Escribir al negocio'");
  ok(((await escribir.getAttribute("href")) ?? "").startsWith("https://wa.me/573001112233?text="), "ese botón abre WhatsApp con el negocio");
  await p.goto(`${BASE}/cita/${c.token}/reprogramar`);
  ok(new URL(p.url()).pathname === `/cita/${c.token}`, "entrar directo a /reprogramar pasado el límite devuelve a la cita");
  ok((await c.ref.get()).data().estado === "confirmada", "la cita sigue intacta");

  // 6. Con anticipo sin pagar: se puede cancelar aunque falte poco, pero no mover
  c = await sembrarCita(A, { inicio: en2h + 3600_000, whatsapp: "573100000008", nombre: "Hugo Anticipo", estado: "pendiente_pago", retieneHasta: Date.now() + 600_000 });
  p = await nuevaPagina(browser);
  await p.goto(`${BASE}/cita/${c.token}`);
  ok((await p.getByRole("button", { name: "Cancelar mi cita" }).isVisible()) && !(await p.getByRole("link", { name: "Cambiar el día o la hora" }).count()), "una cita con anticipo sin pagar se puede cancelar, pero no mover");
  ok((await fetch(`${BASE}/cita/token-inventado/reprogramar`)).status === 404, "/reprogramar con un enlace inventado da 404");

  // ---------- Negocio B: servicio de 4 horas (una sola hora al día) para llenar un día fácil ----------
  const una = [["09:00", "13:00"]];
  const B = await sembrar({
    nombre: "b",
    servicios: [{ nombre: "Tinte completo", duracionMin: 240, precio: 90000 }],
    horario: { lun: una, mar: una, mie: una, jue: una, vie: una, sab: una, dom: [] },
  });
  const llena = await sembrarCita(B, { duracionMin: 240, inicio: utc(FECHA2, "09:00"), whatsapp: "573100000009", nombre: "Ines Dueña del Hueco" });

  // 7. Lista de espera: alta
  async function unirse(pg, { fecha, nombre, whatsapp }) {
    await pg.goto(`${BASE}/${B.slug}`);
    await pg.getByRole("button", { name: /Tinte completo/ }).click();
    await pg.locator("[data-fecha]").first().waitFor({ timeout: 15000 });
    await pg.getByText("Avísame si se libera algo").click();
    await pg.getByLabel("¿Qué día?").fill(fecha);
    await pg.getByLabel("Tu nombre").last().fill(nombre);
    await pg.getByLabel("Tu WhatsApp").last().fill(whatsapp);
    await pg.getByRole("button", { name: "Avisarme" }).click();
  }
  p = await nuevaPagina(browser);
  await unirse(p, { fecha: FECHA, nombre: "Juan Impaciente", whatsapp: "300 000 0010" });
  ok(await p.getByText("todavía tiene horas libres").waitFor({ timeout: 15000 }).then(() => true, () => false), "no deja anotarse en un día que todavía tiene horas: le pide reservar");
  ok((await B.ref.collection("waitlist").get()).size === 0, "y no se guarda nada");
  const espera = [];
  for (const [nombre, w] of [["Karen Espera", "300 000 0011"], ["Luca Espera", "300 000 0012"]]) {
    p = await nuevaPagina(browser);
    await unirse(p, { fecha: FECHA2, nombre, whatsapp: w });
    ok(await p.getByText("quedaste en la lista de espera").waitFor({ timeout: 15000 }).then(() => true, () => false), `${nombre} queda en la lista de espera del día lleno`);
    espera.push(p);
  }
  if (process.env.SHOT) await espera[0].screenshot({ path: `${process.env.SHOT}-espera.png`, fullPage: true });
  let ws = (await B.ref.collection("waitlist").get()).docs.map((x) => x.data());
  ok(ws.length === 2 && ws.every((w) => w.estado === "esperando" && w.fecha === FECHA2 && w.sedeId === B.sede && w.servicioId === B.servIds[0]), "se guardan 2 avisos 'esperando' con servicio, sede y día");
  p = await nuevaPagina(browser);
  await unirse(p, { fecha: FECHA2, nombre: "Karen Espera", whatsapp: "300 000 0011" });
  await p.getByText("quedaste en la lista de espera").waitFor({ timeout: 15000 });
  ok((await B.ref.collection("waitlist").get()).size === 2, "anotarse dos veces para el mismo día no duplica el aviso");

  // 8. Se libera el hueco → avisos marcados con la hora y el enlace directo
  p = await nuevaPagina(browser);
  await p.goto(`${BASE}/cita/${llena.token}`);
  await p.getByRole("button", { name: "Cancelar mi cita" }).click();
  await p.getByRole("button", { name: "Sí, cancelar" }).click();
  await p.getByText("Cancelaste esta cita").waitFor({ timeout: 15000 });
  ws = (await B.ref.collection("waitlist").get()).docs.map((x) => x.data());
  ok(ws.length === 2 && ws.every((w) => w.estado === "hueco_libre" && w.hueco?.fecha === FECHA2 && w.hueco?.hora === "09:00"), "al cancelarse la cita, los 2 que esperaban quedan marcados 'hueco_libre' con la hora liberada (09:00)");

  // 9. Los dos abren su enlace directo y pulsan "Confirmar" a la vez: gana uno
  const enlace = `/${B.slug}?sede=${B.sede}&servicio=${B.servIds[0]}&fecha=${FECHA2}&hora=09:00`;
  const carrera = [];
  for (const [nombre, w] of [["Karen Espera", "300 000 0011"], ["Luca Espera", "300 000 0012"]]) {
    const pg = await nuevaPagina(browser);
    await pg.goto(`${BASE}${enlace}`);
    await pg.getByText("Tus datos").waitFor({ timeout: 15000 });
    await pg.getByLabel("Tu nombre").first().fill(nombre);
    await pg.getByLabel("Tu WhatsApp").first().fill(w);
    carrera.push(pg);
  }
  ok((await carrera[0].getByText("9:00 a. m.").first().isVisible()) && (await carrera[0].getByText("Tinte completo").first().isVisible()), "el enlace del aviso abre la reserva con servicio, día y hora ya elegidos");
  if (process.env.SHOT) await carrera[0].screenshot({ path: `${process.env.SHOT}-enlace-hueco.png`, fullPage: true });
  await Promise.all(carrera.map((pg) => pg.getByRole("button", { name: "Confirmar reserva" }).click()));
  const res2 = await Promise.all(carrera.map((pg) => resultado(pg, /\/cita\//)));
  const reservadas = (await B.ref.collection("appointments").where("inicio", "==", utc(FECHA2, "09:00")).where("estado", "==", "confirmada").get()).size;
  ok(res2.filter((x) => x === "ok").length === 1 && res2.filter((x) => x === "error").length === 1 && reservadas === 1, `el hueco lo gana solo uno de los dos que esperaban (resultados: ${res2.join(", ")}; citas confirmadas a las 09:00: ${reservadas})`);
  ws = (await B.ref.collection("waitlist").get()).docs.map((x) => x.data());
  ok(ws.filter((w) => w.estado === "reservado").length === 1 && ws.filter((w) => w.estado === "hueco_libre").length === 1, "quien reservó sale de la lista (reservado); el otro sigue esperando");

  // 10. Un enlace de hueco con datos inventados no rompe la página
  p = await nuevaPagina(browser);
  const r = await p.goto(`${BASE}/${B.slug}?sede=x&servicio=y&fecha=no-es-fecha&hora=zz`);
  ok(r.status() === 200 && (await p.getByText("¿Qué servicio quieres?").isVisible()), "un enlace de hueco con datos inventados abre la reserva normal, sin error");
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
