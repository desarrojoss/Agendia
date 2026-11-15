"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, crearSesion } from "@/lib/auth-server";
import { getAuthAdmin, getDb } from "@/lib/firebase-admin";
import { errorDeSlug } from "@/lib/slug";
import { REGLAS_POR_DEFECTO, type Miembro, type Negocio } from "@/lib/types";

type R = { error: string } | { ok: true };
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Inicia sesión con correo y contraseña (REST de Identity Toolkit) y deja la cookie. */
async function entrar(correo: string, password: string): Promise<R> {
  // mismo mensaje para "no existe" y "contraseña mala": no revela quién tiene cuenta
  const invalido = { error: "Correo o contraseña incorrectos." };
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: correo, password, returnSecureToken: true }),
    });
    const d = await r.json();
    if (!r.ok) return /TOO_MANY/.test(d.error?.message ?? "") ? { error: "Demasiados intentos. Espera unos minutos." } : invalido;
    // Solo entran usuarios que pertenecen a un negocio (Firebase deja registrar cuentas sueltas con la API key pública).
    const uid = (await getAuthAdmin().verifyIdToken(d.idToken)).uid;
    if (!(await getDb().collection("members").doc(uid).get()).exists) return invalido;
    await crearSesion(d.idToken);
    return { ok: true };
  } catch (e) {
    console.error("entrar", e);
    return { error: "No pudimos conectar. Intenta de nuevo." };
  }
}

export async function iniciarSesion(email: string, password: string): Promise<R> {
  const correo = String(email ?? "").trim().toLowerCase();
  if (!correo || !password) return { error: "Escribe tu correo y contraseña." };
  return entrar(correo, String(password));
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}

/** Para avisar en vivo si el enlace está libre mientras el dueño escribe. */
export async function slugDisponible(slug: string): Promise<{ libre: boolean; motivo?: string }> {
  const s = String(slug ?? "").trim();
  const motivo = errorDeSlug(s);
  if (motivo) return { libre: false, motivo };
  const ya = (await getDb().collection("slugs").doc(s).get()).exists;
  return ya ? { libre: false, motivo: "Ese enlace ya lo usa otro negocio." } : { libre: true };
}

export type DatosRegistro = { nombre: string; correo: string; password: string; negocio: string; slug: string };

/** Registro del dueño + paso 1 del asistente (nombre y enlace del negocio). Crea usuario, negocio, slug y membresía. */
export async function registrarNegocio(datos: DatosRegistro): Promise<R> {
  const nombre = String(datos.nombre ?? "").trim();
  const correo = String(datos.correo ?? "").trim().toLowerCase();
  const password = String(datos.password ?? "");
  const negocio = String(datos.negocio ?? "").trim();
  const slug = String(datos.slug ?? "").trim();

  if (nombre.length < 2) return { error: "Escribe tu nombre." };
  if (!REGEX_CORREO.test(correo)) return { error: "Revisa tu correo, no parece válido." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (negocio.length < 2 || negocio.length > 60) return { error: "Escribe el nombre de tu negocio (2 a 60 caracteres)." };
  const motivo = errorDeSlug(slug);
  if (motivo) return { error: motivo };

  const db = getDb();
  const auth = getAuthAdmin();
  let uid: string;
  try {
    uid = (await auth.createUser({ email: correo, password, displayName: nombre })).uid;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/email-already-exists") return { error: "Ese correo ya tiene cuenta. Inicia sesión." };
    if (code === "auth/invalid-password") return { error: "La contraseña debe tener al menos 8 caracteres." };
    console.error("createUser", e);
    return { error: "No pudimos crear tu cuenta. Intenta de nuevo." };
  }

  try {
    const bizRef = db.collection("businesses").doc();
    await db.runTransaction(async (t) => {
      const slugRef = db.collection("slugs").doc(slug);
      if ((await t.get(slugRef)).exists) throw new Error("SLUG_OCUPADO");
      const biz: Negocio = {
        nombre: negocio, slug, logoUrl: null, direccion: "", whatsapp: "", zona: "America/Bogota",
        reglas: REGLAS_POR_DEFECTO, demo: false, suspendido: false, ownerUid: uid,
      };
      const miembro: Miembro = { bizId: bizRef.id, rol: "dueno", staffId: null };
      t.set(slugRef, { bizId: bizRef.id });
      t.set(bizRef, { ...biz, creado: Date.now() });
      t.set(db.collection("members").doc(uid), miembro);
      // Todo negocio tiene al menos una sede; con una sola, el cliente ni la ve en el flujo de reserva.
      t.set(bizRef.collection("locations").doc(), { nombre: "Sede principal", direccion: "", whatsapp: "", activo: true, orden: 0 });
    });
  } catch (e) {
    await auth.deleteUser(uid).catch(() => {}); // sin negocio no se deja una cuenta huérfana
    if ((e as Error).message === "SLUG_OCUPADO") return { error: "Ese enlace ya lo usa otro negocio. Elige otro." };
    console.error("registrarNegocio", e);
    return { error: "No pudimos crear tu negocio. Intenta de nuevo." };
  }

  return entrar(correo, password);
}
