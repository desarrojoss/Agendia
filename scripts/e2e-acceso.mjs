// Prueba de punta a punta de la ejecución 1 (registro, login, sesión y aislamiento entre negocios).
// Uso: BASE_URL=http://localhost:3100 node scripts/e2e-acceso.mjs   (necesita .env.local para limpiar los datos de prueba)
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
const A = { negocio: `Barbería Prueba A ${id}`, slug: `prueba-a-${id}`, correo: `a-${id}@agendia-test.dev`, nombre: "Dueño A", password: "clave-segura-A1" };
const B = { negocio: `Salón Prueba B ${id}`, slug: `prueba-b-${id}`, correo: `b-${id}@agendia-test.dev`, nombre: "Dueño B", password: "clave-segura-B1" };
const SUELTO = { correo: `suelto-${id}@agendia-test.dev`, password: "clave-suelta-1" };

let fallos = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fallos++;
};

async function registrar(page, d) {
  await page.goto(`${BASE}/registro`);
  await page.getByLabel("Nombre de tu negocio").fill(d.negocio);
  await page.getByLabel("Tu nombre").fill(d.nombre);
  await page.getByLabel("Correo").fill(d.correo);
  await page.getByLabel(/^Contraseña/).fill(d.password);
}

const browser = await chromium.launch();
try {
  const ctxA = await browser.newContext();
  const a = await ctxA.newPage();

  // 1. Sin sesión, el panel manda al login
  await a.goto(`${BASE}/panel`);
  ok(a.url().endsWith("/login"), "sin sesión, /panel redirige a /login");

  // 2. Registro de A: el enlace se propone solo y se marca como disponible
  await registrar(a, A);
  await a.getByLabel("Tu enlace para compartir").fill(A.slug);
  ok(await a.getByText("✓ Disponible").waitFor({ timeout: 10000 }).then(() => true, () => false), "el enlace libre se marca como disponible");
  await a.getByRole("button", { name: /Crear mi agenda/ }).click();
  await a.waitForURL(/\/panel$/, { timeout: 30000 });
  ok(await a.getByRole("heading", { name: A.negocio }).isVisible(), "tras registrarse, el panel muestra el negocio A");

  // 3. Página pública del negocio
  const pub = await ctxA.newPage();
  await pub.goto(`${BASE}/${A.slug}`);
  ok(await pub.getByRole("heading", { name: A.negocio }).isVisible(), "la página pública /<enlace> muestra el negocio");
  await pub.goto(`${BASE}/no-existe-${id}`);
  ok((await pub.content()).includes("404") || (await pub.getByText(/no se encontr|not found|404/i).count()) > 0, "un enlace inexistente da 404");

  // 4. Enlace repetido, reservado y correo repetido
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await registrar(b, B);
  await b.getByLabel("Tu enlace para compartir").fill(A.slug);
  ok(await b.getByText("Ese enlace ya lo usa otro negocio.").waitFor({ timeout: 10000 }).then(() => true, () => false), "un enlace ya usado se avisa en vivo");
  ok(await b.getByRole("button", { name: /Crear mi agenda/ }).isDisabled(), "con enlace ocupado no se puede enviar");
  await b.getByLabel("Tu enlace para compartir").fill("panel");
  ok(await b.getByText("Ese enlace está reservado.").waitFor({ timeout: 5000 }).then(() => true, () => false), "un enlace reservado se rechaza");
  await b.getByLabel("Tu enlace para compartir").fill(B.slug);
  await b.getByLabel("Correo").fill(A.correo);
  await b.getByText("✓ Disponible").waitFor({ timeout: 10000 });
  await b.getByRole("button", { name: /Crear mi agenda/ }).click();
  ok(await b.getByText("Ese correo ya tiene cuenta.").waitFor({ timeout: 15000 }).then(() => true, () => false), "un correo ya registrado se rechaza");

  // 5. Registro de B y aislamiento
  await b.getByLabel("Correo").fill(B.correo);
  await b.getByRole("button", { name: /Crear mi agenda/ }).click();
  await b.waitForURL(/\/panel$/, { timeout: 30000 });
  ok(await b.getByRole("heading", { name: B.negocio }).isVisible(), "el panel de B muestra el negocio B");
  ok((await b.content()).includes(A.negocio) === false, "el panel de B no contiene nada del negocio A");
  const bizA = (await db.collection("slugs").doc(A.slug).get()).data().bizId;
  await b.goto(`${BASE}/panel?bizId=${bizA}&biz=${A.slug}`);
  ok(await b.getByRole("heading", { name: B.negocio }).isVisible() && !(await b.content()).includes(A.negocio), "un bizId en la URL se ignora: el negocio sale de la sesión");

  // 6. Salir, contraseña mala, y entrar
  await a.getByRole("button", { name: "Salir" }).click();
  await a.waitForURL(/\/login$/);
  await a.goto(`${BASE}/panel`);
  ok(a.url().endsWith("/login"), "tras salir, /panel vuelve a pedir login");
  await a.getByLabel("Correo").fill(A.correo);
  await a.getByLabel("Contraseña").fill("mala-contraseña");
  await a.getByRole("button", { name: "Entrar" }).click();
  ok(await a.getByText("Correo o contraseña incorrectos.").waitFor({ timeout: 15000 }).then(() => true, () => false), "contraseña incorrecta se rechaza");
  await a.getByLabel("Contraseña").fill(A.password);
  await a.getByRole("button", { name: "Entrar" }).click();
  await a.waitForURL(/\/panel$/, { timeout: 30000 });
  ok(await a.getByRole("heading", { name: A.negocio }).isVisible(), "login correcto lleva al panel de A");

  // 7. Una cuenta de Firebase Auth SIN negocio no entra (la API key pública deja crear usuarios sueltos)
  await auth.createUser({ email: SUELTO.correo, password: SUELTO.password });
  const c = await (await browser.newContext()).newPage();
  await c.goto(`${BASE}/login`);
  await c.getByLabel("Correo").fill(SUELTO.correo);
  await c.getByLabel("Contraseña").fill(SUELTO.password);
  await c.getByRole("button", { name: "Entrar" }).click();
  ok(await c.getByText("Correo o contraseña incorrectos.").waitFor({ timeout: 15000 }).then(() => true, () => false), "un usuario sin negocio no puede entrar");
  await c.goto(`${BASE}/panel`);
  ok(c.url().endsWith("/login"), "y tampoco ve el panel");
} catch (e) {
  console.error("✗ error inesperado:", e.message);
  fallos++;
} finally {
  await browser.close();
  // Limpieza de los datos de prueba
  for (const d of [A, B]) {
    try {
      const s = await db.collection("slugs").doc(d.slug).get();
      const uid = (await auth.getUserByEmail(d.correo).catch(() => null))?.uid;
      if (s.exists) await db.collection("businesses").doc(s.data().bizId).delete();
      await db.collection("slugs").doc(d.slug).delete();
      if (uid) {
        await db.collection("members").doc(uid).delete();
        await auth.deleteUser(uid);
      }
    } catch (e) {
      console.error("limpieza", d.slug, e.message);
    }
  }
  const suelto = await auth.getUserByEmail(SUELTO.correo).catch(() => null);
  if (suelto) await auth.deleteUser(suelto.uid);
}
console.log(fallos ? `\n${fallos} fallo(s)` : "\nTodo bien");
process.exit(fallos ? 1 : 0);
