// Prueba de punta a punta de la ejecución 2 (configuración del negocio): sedes, servicios, equipo con horario y foto,
// bloqueos, datos y reglas del negocio, cambio de enlace, aislamiento y rol profesional.
// Uso: BASE_URL=http://localhost:3100 node scripts/e2e-config.mjs   (necesita .env.local; borra todo lo que crea)
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const sa = JSON.parse(Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString());
const app = initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }) });
const auth = getAuth(app);
const db = getFirestore(app);
cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET });

const id = Date.now().toString(36);
const mk = (x, n) => ({ negocio: `Barbería Config ${x} ${id}`, slug: `config-${x}-${id}`, correo: `${x}-${id}@agendia-test.dev`, nombre: `Dueño ${x}`, password: `clave-segura-${n}` });
const A = mk("a", 1);
const B = mk("b", 2);
const PRO = { correo: `pro-${id}@agendia-test.dev`, password: "clave-profesional-1" };
const PNG = join(tmpdir(), `agendia-test-${id}.png`);
writeFileSync(PNG, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

let fallos = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallos++;
};
const visible = (loc, t = 10000) => loc.waitFor({ timeout: t }).then(() => true, () => false);

async function registrar(page, d) {
  await page.goto(`${BASE}/registro`);
  await page.getByLabel("Nombre de tu negocio").fill(d.negocio);
  await page.getByLabel("Tu enlace para compartir").fill(d.slug);
  await page.getByLabel("Tu nombre").fill(d.nombre);
  await page.getByLabel("Correo").fill(d.correo);
  await page.getByLabel(/^Contraseña/).fill(d.password);
  await page.getByText("✓ Disponible").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /Crear mi agenda/ }).click();
  await page.waitForURL(/\/panel$/, { timeout: 30000 });
}

let bizA = null;
let bizB = null;
const browser = await chromium.launch();
try {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();
  await registrar(a, A);
  bizA = (await db.collection("slugs").doc(A.slug).get()).data().bizId;

  // 0. Todo negocio nace con una sede principal
  const sedes0 = await db.collection(`businesses/${bizA}/locations`).get();
  ok(sedes0.size === 1 && sedes0.docs[0].data().nombre === "Sede principal", "el negocio nace con una sede principal");
  ok(await visible(a.getByText("Deja lista tu agenda")), "el asistente aparece con los pasos pendientes");

  // 1. Sede nueva
  await a.goto(`${BASE}/panel/sedes/nuevo`);
  await a.getByLabel("Nombre de la sede").fill("Sede Norte");
  await a.getByLabel(/^Dirección/).fill("Calle 98 # 52-10");
  await a.getByRole("button", { name: "Guardar" }).click();
  await a.waitForURL(/\/panel\/sedes$/);
  ok(await visible(a.getByText("Sede Norte")), "se crea una segunda sede");

  // 2. Servicios
  await a.goto(`${BASE}/panel/servicios/nuevo`);
  await a.getByLabel("Nombre del servicio").fill("Corte de cabello");
  await a.getByLabel("Precio (COP)").fill("25000");
  await a.getByRole("button", { name: "Guardar" }).click();
  await a.waitForURL(/\/panel\/servicios$/);
  ok(await visible(a.getByText("30 min · $ 25.000", { exact: false }).or(a.getByText("30 min · $25.000", { exact: false }))), "el servicio se lista con duración y precio");

  await a.goto(`${BASE}/panel/servicios/nuevo`);
  await a.getByLabel("Nombre del servicio").fill("Corte + barba");
  await a.getByLabel("Duración (minutos)").fill("60");
  await a.getByLabel("Precio (COP)").fill("40000");
  await a.getByLabel("Tipo de anticipo").selectOption("monto");
  await a.getByLabel("Valor (COP)").fill("90000");
  await a.getByRole("button", { name: "Guardar" }).click();
  ok(await visible(a.getByText("El anticipo no puede ser mayor que el precio del servicio.")), "un anticipo mayor al precio se rechaza");
  await a.getByLabel("Tipo de anticipo").selectOption("porcentaje");
  await a.getByLabel("Porcentaje (%)").fill("30");
  await a.getByRole("button", { name: "Guardar" }).click();
  await a.waitForURL(/\/panel\/servicios$/);
  ok(await visible(a.getByText("Anticipo 30%", { exact: false })), "un servicio con anticipo en porcentaje se guarda");

  // orden: subir el segundo ("Corte + barba" pasa a ser el primero)
  const primero = async () => (await db.collection(`businesses/${bizA}/services`).orderBy("orden").limit(1).get()).docs[0].data().nombre;
  ok((await primero()) === "Corte de cabello", "al inicio el primero de la lista es el primero que se creó");
  await a.getByRole("button", { name: "Subir" }).nth(1).click();
  let sube = false;
  for (let k = 0; k < 20 && !sube; k++) {
    sube = (await primero()) === "Corte + barba";
    if (!sube) await a.waitForTimeout(500);
  }
  ok(sube, "el servicio sube de posición");

  // ocultar y mostrar
  await a.getByRole("button", { name: "Ocultar" }).first().click();
  ok(await visible(a.getByText("Oculto")), "un servicio se puede ocultar");
  await a.getByRole("button", { name: "Mostrar" }).first().click();
  await a.getByText("Oculto").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});

  // 3. Equipo: foto real a Cloudinary + horario
  await a.goto(`${BASE}/panel/equipo/nuevo`);
  await a.getByLabel("Nombre", { exact: true }).fill("Luis Pérez");
  await a.getByText("Corte de cabello").first().click();
  await a.getByText("Corte + barba").first().click();
  await a.locator('input[type="file"]').setInputFiles(PNG);
  ok(await visible(a.locator('img[src*="res.cloudinary.com"]'), 30000), "la foto se sube a Cloudinary y se muestra");
  // horario inválido: fin antes que inicio
  await a.getByLabel("Lunes, desde").first().fill("15:00");
  await a.getByLabel("Lunes, hasta").first().fill("10:00");
  await a.getByRole("button", { name: "Guardar" }).click();
  ok(await visible(a.getByText("En cada tramo la hora de inicio debe ser antes que la de fin.")), "un tramo con fin antes del inicio se rechaza");
  await a.getByLabel("Lunes, desde").first().fill("09:00");
  await a.getByLabel("Lunes, hasta").first().fill("13:00");
  await a.getByRole("button", { name: "Guardar" }).click();
  await a.waitForURL(/\/panel\/equipo$/, { timeout: 20000 });
  ok(await visible(a.getByText("Luis Pérez")), "el profesional se guarda");
  const staff = (await db.collection(`businesses/${bizA}/staff`).get()).docs.map((d) => d.data());
  ok(staff.length === 1 && staff[0].servicios.length === 2 && staff[0].horario.lun.length === 2, "el profesional queda con sus 2 servicios y el horario con pausa");
  ok(String(staff[0].fotoUrl).includes(`/agendia/${bizA}/personal/`), "la foto queda en la carpeta del negocio en Cloudinary");
  ok(typeof staff[0].icsToken === "string" && staff[0].icsToken.length === 32, "se genera el secreto del calendario del profesional");

  // 4. Asistente completo
  await a.goto(`${BASE}/panel`);
  ok(await visible(a.getByText("Tu agenda está lista")) && (await visible(a.getByRole("button", { name: "Copiar enlace" }))), "con servicios y profesional, el asistente queda listo y muestra el enlace");

  // 5. Bloqueos (Bogotá = UTC-5)
  await a.goto(`${BASE}/panel/bloqueos`);
  await a.getByLabel("Desde el").fill("2030-12-24");
  await a.getByLabel("Hasta el").fill("2030-12-25");
  await a.getByLabel("Motivo").fill("Navidad");
  await a.getByRole("button", { name: "Bloquear" }).click();
  ok(await visible(a.getByText("Navidad")), "el bloqueo de varios días se crea");
  const bl = (await db.collection(`businesses/${bizA}/blocks`).get()).docs.map((d) => d.data());
  ok(bl.length === 1 && bl[0].inicio === Date.UTC(2030, 11, 24, 5, 0) && bl[0].fin === Date.UTC(2030, 11, 26, 5, 0) && bl[0].staffId === null, "se guarda en UTC con la hora de Bogotá (24 dic 00:00 → 26 dic 00:00)");
  await a.getByRole("button", { name: "Quitar" }).click();
  await a.getByText("Navidad").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  ok((await db.collection(`businesses/${bizA}/blocks`).get()).size === 0, "el bloqueo se puede quitar");

  // 6. Negocio: datos, reglas, logo y cambio de enlace
  await a.goto(`${BASE}/panel/negocio`);
  await a.getByLabel(/^Nombre$/).fill(`Barbería Renombrada ${id}`);
  await a.getByLabel(/^WhatsApp del negocio/).fill("300 123 4567");
  await a.getByLabel(/^Reservar con al menos/).fill("3");
  await a.getByLabel(/^Reservar hasta/).fill("45");
  await a.getByLabel(/^Cancelar o cambiar hasta/).fill("6");
  await a.getByLabel("Una hora disponible cada").selectOption("15");
  await a.locator('input[type="file"]').setInputFiles(PNG);
  ok(await visible(a.locator('img[src*="res.cloudinary.com"]'), 30000), "el logo se sube a Cloudinary");
  const nuevoSlug = `${A.slug}-nuevo`;
  await a.getByLabel("Enlace para compartir").fill(B.slug); // el de B todavía no existe: se usará abajo para probar un duplicado
  await a.getByLabel("Enlace para compartir").fill(nuevoSlug);
  await a.getByRole("button", { name: "Guardar cambios" }).click();
  ok(await visible(a.getByText("Cambios guardados.")), "los datos del negocio se guardan");
  const n = (await db.collection("businesses").doc(bizA).get()).data();
  ok(n.whatsapp === "573001234567", "el WhatsApp se guarda con indicativo (57)");
  ok(n.reglas.anticipacionMin === 180 && n.reglas.ventanaDias === 45 && n.reglas.limiteCancelarMin === 360 && n.reglas.intervaloMin === 15, "las reglas de reserva se guardan (horas → minutos)");
  ok(n.slug === nuevoSlug && !(await db.collection("slugs").doc(A.slug).get()).exists && (await db.collection("slugs").doc(nuevoSlug).get()).data().bizId === bizA, "el enlace cambia: el nuevo existe y el viejo se libera");
  const pub = await ctxA.newPage();
  const r1 = await pub.goto(`${BASE}/${nuevoSlug}`);
  const r2 = await pub.goto(`${BASE}/${A.slug}`);
  ok(r1 !== null && (await pub.goto(`${BASE}/${nuevoSlug}`))?.status() === 200 && r2?.status() === 404, "el enlace nuevo abre la página y el viejo da 404");

  // 7. Aislamiento con otro negocio
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await registrar(b, B);
  bizB = (await db.collection("slugs").doc(B.slug).get()).data().bizId;
  const idServicioA = (await db.collection(`businesses/${bizA}/services`).get()).docs[0].id;
  const idPersonalA = (await db.collection(`businesses/${bizA}/staff`).get()).docs[0].id;
  const r3 = await b.goto(`${BASE}/panel/servicios/${idServicioA}`);
  ok(r3?.status() === 404, "B no puede abrir un servicio de A por su id");
  const r4 = await b.goto(`${BASE}/panel/equipo/${idPersonalA}`);
  ok(r4?.status() === 404, "B no puede abrir un profesional de A por su id");
  await b.goto(`${BASE}/panel/servicios`);
  ok(!(await b.content()).includes("Corte de cabello"), "la lista de B no contiene servicios de A");
  await b.goto(`${BASE}/panel/negocio`);
  await b.getByLabel("Enlace para compartir").fill(nuevoSlug);
  await b.getByRole("button", { name: "Guardar cambios" }).click();
  ok(await visible(b.getByText("Ese enlace ya lo usa otro negocio.")), "B no puede quedarse con el enlace de A");

  // 8. Rol profesional: entra al panel pero no a la configuración
  const u = await auth.createUser({ email: PRO.correo, password: PRO.password });
  await db.collection("members").doc(u.uid).set({ bizId: bizA, rol: "profesional", staffId: idPersonalA });
  const ctxP = await browser.newContext();
  const p = await ctxP.newPage();
  await p.goto(`${BASE}/login`);
  await p.getByLabel("Correo").fill(PRO.correo);
  await p.getByLabel("Contraseña").fill(PRO.password);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForURL(/\/panel$/, { timeout: 30000 });
  ok((await p.getByRole("link", { name: "Servicios" }).count()) === 0, "el profesional no ve el menú de configuración");
  await p.goto(`${BASE}/panel/servicios`);
  ok(p.url().endsWith("/panel"), "si el profesional abre /panel/servicios, vuelve al panel");
  await p.goto(`${BASE}/panel/negocio`);
  ok(p.url().endsWith("/panel"), "ni /panel/negocio");
} catch (e) {
  console.error("✗ error inesperado:", e.message);
  fallos++;
} finally {
  await browser.close();
  for (const [d, biz] of [[A, bizA], [B, bizB]]) {
    try {
      if (biz) {
        await db.recursiveDelete(db.collection("businesses").doc(biz));
        for (const s of (await db.collection("slugs").where("bizId", "==", biz).get()).docs) await s.ref.delete();
        for (const m of (await db.collection("members").where("bizId", "==", biz).get()).docs) await m.ref.delete();
        await cloudinary.api.delete_resources_by_prefix(`agendia/${biz}/`).catch(() => {});
        await cloudinary.api.delete_folder(`agendia/${biz}`).catch(() => {});
      }
      const u = await auth.getUserByEmail(d.correo).catch(() => null);
      if (u) await auth.deleteUser(u.uid);
    } catch (e) {
      console.error("limpieza", d.slug, e.message);
    }
  }
  const pro = await auth.getUserByEmail(PRO.correo).catch(() => null);
  if (pro) await auth.deleteUser(pro.uid);
}
console.log(fallos ? `\n${fallos} fallo(s)` : "\nTodo bien");
process.exit(fallos ? 1 : 0);
