// Prueba de punta a punta de la ejecución 3: el motor de disponibilidad con datos reales de Firestore,
// vista desde la pantalla "Disponibilidad" del panel. Cada paso cambia los datos (citas, bloqueos) y mira qué horas quedan.
// Uso: BASE_URL=http://localhost:3100 node scripts/e2e-disponibilidad.mjs   (necesita .env.local; borra todo lo que crea)
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const sa = JSON.parse(Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString());
const app = initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }) });
const auth = getAuth(app);
const db = getFirestore(app);

const id = Date.now().toString(36);
const A = { negocio: `Barbería Disp ${id}`, slug: `disp-${id}`, correo: `disp-${id}@agendia-test.dev`, nombre: "Dueño Disp", password: "clave-segura-D1" };

let fallos = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallos++;
};

// Fechas en Bogotá (UTC-5, sin horario de verano)
const hoyBogota = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
const sumar = (f, n) => new Date(Date.parse(`${f}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
const diaSemana = (f) => new Date(`${f}T00:00:00Z`).getUTCDay(); // 0 = domingo, 1 = lunes
const utc = (fecha, hora) => Date.parse(`${fecha}T${hora}:00Z`) + 5 * 3600_000;
let lunes = sumar(hoyBogota(), 2);
while (diaSemana(lunes) !== 1) lunes = sumar(lunes, 1);
const domingo = sumar(lunes, 6);
const lejano = sumar(hoyBogota(), 90);

let biz = null;
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${BASE}/registro`);
  await page.getByLabel("Nombre de tu negocio").fill(A.negocio);
  await page.getByLabel("Tu enlace para compartir").fill(A.slug);
  await page.getByLabel("Tu nombre").fill(A.nombre);
  await page.getByLabel("Correo").fill(A.correo);
  await page.getByLabel(/^Contraseña/).fill(A.password);
  await page.getByText("✓ Disponible").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /Crear mi agenda/ }).click();
  await page.waitForURL(/\/panel$/, { timeout: 30000 });
  biz = (await db.collection("slugs").doc(A.slug).get()).data().bizId;

  // Datos de prueba: un servicio de 30 min y dos profesionales con horario partido (lunes a viernes 9-13 y 14-18)
  const col = (n) => db.collection(`businesses/${biz}/${n}`);
  const sede = (await col("locations").get()).docs[0].id;
  const servicio = await col("services").add({ nombre: "Corte", descripcion: "", duracionMin: 30, precio: 25000, anticipo: { tipo: "ninguno" }, sedes: [sede], activo: true, orden: 0 });
  const dia = [["09:00", "13:00"], ["14:00", "18:00"]];
  const horario = { lun: dia, mar: dia, mie: dia, jue: dia, vie: dia, sab: [], dom: [] };
  const mkPersona = (nombre) => col("staff").add({ nombre, fotoUrl: null, email: "", uid: null, sedeId: sede, servicios: [servicio.id], horario, activo: true, icsToken: "x".repeat(32) });
  const luis = await mkPersona("Luis");
  const ana = await mkPersona("Ana");

  const ver = async (fecha, persona) => {
    await page.goto(`${BASE}/panel/disponibilidad`);
    await page.getByLabel(/^Profesional/).selectOption({ label: persona });
    await page.getByLabel("Fecha", { exact: true }).fill(fecha);
    await page.getByRole("button", { name: "Ver horas libres" }).click();
    await page.getByRole("heading", { name: /libres|sin horas/ }).first().waitFor({ timeout: 15000 });
    const horas = await page.locator("li[data-hora]").evaluateAll((els) => els.map((e) => ({ hora: e.getAttribute("data-hora"), texto: e.textContent })));
    return horas;
  };
  const soloHoras = (r) => r.map((x) => x.hora);

  // 1. Horario con pausa
  let r = await ver(lunes, "Luis");
  ok(r.length === 16 && soloHoras(r)[0] === "09:00" && soloHoras(r).at(-1) === "17:30", "un lunes normal: 16 horas, de 09:00 a 17:30");
  ok(!soloHoras(r).includes("13:00") && !soloHoras(r).includes("13:30"), "la pausa de 13:00 a 14:00 no se ofrece");

  // 2. Una cita confirmada ocupa su espacio (10:00 a 11:00)
  await col("appointments").add({ staffId: luis.id, servicioId: servicio.id, inicio: utc(lunes, "10:00"), fin: utc(lunes, "11:00"), estado: "confirmada" });
  r = await ver(lunes, "Luis");
  ok(!soloHoras(r).includes("10:00") && !soloHoras(r).includes("10:30") && soloHoras(r).includes("09:30") && soloHoras(r).includes("11:00"), "una cita de 10:00 a 11:00 quita 10:00 y 10:30, y deja libres 09:30 y 11:00");

  // 3. Pago pendiente: retiene la hora solo mientras dura la retención; una cancelada no estorba
  await col("appointments").add({ staffId: luis.id, servicioId: servicio.id, inicio: utc(lunes, "15:00"), fin: utc(lunes, "15:30"), estado: "pendiente_pago", retieneHasta: Date.now() + 600_000 });
  await col("appointments").add({ staffId: luis.id, servicioId: servicio.id, inicio: utc(lunes, "16:00"), fin: utc(lunes, "16:30"), estado: "pendiente_pago", retieneHasta: Date.now() - 600_000 });
  await col("appointments").add({ staffId: luis.id, servicioId: servicio.id, inicio: utc(lunes, "11:00"), fin: utc(lunes, "11:30"), estado: "cancelada" });
  r = await ver(lunes, "Luis");
  ok(!soloHoras(r).includes("15:00"), "un pago pendiente vigente retiene la hora");
  ok(soloHoras(r).includes("16:00"), "un pago pendiente vencido libera la hora solo");
  ok(soloHoras(r).includes("11:00"), "una cita cancelada libera la hora");

  // 4. Bloqueo de todo el negocio (14:00 a 16:00)
  const bloqueo = await col("blocks").add({ staffId: null, sedeId: null, inicio: utc(lunes, "14:00"), fin: utc(lunes, "16:00"), motivo: "Reunión" });
  r = await ver(lunes, "Luis");
  ok(["14:00", "14:30", "15:00", "15:30"].every((h) => !soloHoras(r).includes(h)) && soloHoras(r).includes("16:00") && soloHoras(r).includes("13:30") === false, "un bloqueo de 14:00 a 16:00 quita esas horas y respeta el borde (16:00 sí)");
  await bloqueo.delete();

  // 5. "Cualquiera": une los horarios y reparte la carga (Luis ya tiene citas, Ana no)
  r = await ver(lunes, "Cualquiera");
  ok(r.find((x) => x.hora === "10:00")?.texto.includes("Ana"), "con 'cualquiera', a las 10:00 (Luis ocupado) se asigna a Ana");
  ok(r.find((x) => x.hora === "09:00")?.texto.includes("Ana"), "con 'cualquiera', a las 09:00 gana quien tiene menos citas ese día (Ana)");
  await col("appointments").add({ staffId: ana.id, servicioId: servicio.id, inicio: utc(lunes, "10:00"), fin: utc(lunes, "10:30"), estado: "confirmada" });
  r = await ver(lunes, "Cualquiera");
  ok(!soloHoras(r).includes("10:00"), "si los dos están ocupados a las 10:00, esa hora desaparece");

  // 6. Días sin cupo
  r = await ver(domingo, "Luis");
  ok(r.length === 0, "un domingo (sin horario) no ofrece horas");
  r = await ver(lejano, "Luis");
  ok(r.length === 0, "un día fuera de la ventana de reserva (90 días) no ofrece horas");

  // 7. Calendario de días con cupo
  await page.goto(`${BASE}/panel/disponibilidad`);
  await page.getByLabel("Fecha", { exact: true }).fill(lunes);
  await page.getByRole("button", { name: "Ver horas libres" }).click();
  await page.getByRole("heading", { name: "Próximos días con cupo" }).waitFor({ timeout: 15000 });
  const botones = await page.locator("section:has(h2:text('Próximos días con cupo')) button").count();
  ok(botones >= 4 && botones <= 14, `el calendario lista los próximos días con cupo (${botones})`);
  await page.locator("section:has(h2:text('Próximos días con cupo')) button").nth(1).click();
  ok(await page.locator("li[data-hora]").first().waitFor({ timeout: 15000 }).then(() => true, () => false), "tocar un día del calendario muestra sus horas");

  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });

  // 8. Anticipación: con 'hoy' no se ofrece nada que empiece en menos de 2 horas
  const hoy = hoyBogota();
  r = await ver(hoy, "Luis");
  const ahoraBogota = new Date(Date.now() - 5 * 3600_000).toISOString().slice(11, 16);
  const [hh, mm] = ahoraBogota.split(":").map(Number);
  const limite = hh * 60 + mm + 120;
  ok(soloHoras(r).every((h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) >= limite), "hoy no se ofrece nada que empiece en menos de 2 horas (anticipación)");
} catch (e) {
  console.error("✗ error inesperado:", e.message);
  fallos++;
} finally {
  await browser.close();
  try {
    if (biz) {
      await db.recursiveDelete(db.collection("businesses").doc(biz));
      for (const s of (await db.collection("slugs").where("bizId", "==", biz).get()).docs) await s.ref.delete();
      for (const m of (await db.collection("members").where("bizId", "==", biz).get()).docs) await m.ref.delete();
    }
    const u = await auth.getUserByEmail(A.correo).catch(() => null);
    if (u) await auth.deleteUser(u.uid);
  } catch (e) {
    console.error("limpieza", e.message);
  }
}
console.log(fallos ? `\n${fallos} fallo(s)` : "\nTodo bien");
process.exit(fallos ? 1 : 0);
