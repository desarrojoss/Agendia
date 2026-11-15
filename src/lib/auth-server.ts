import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthAdmin, getDb } from "./firebase-admin";
import type { Miembro, Rol } from "./types";

export const COOKIE = "session";
export const DURACION_MS = 5 * 24 * 60 * 60 * 1000; // 5 días

export type Sesion = { uid: string; email: string; nombre: string; bizId: string; rol: Rol; staffId: string | null };

/** Cualquier colección de un negocio cuelga de aquí. Siempre con el bizId de la sesión, NUNCA con uno que venga del cliente. */
export const negocioRef = (bizId: string) => getDb().collection("businesses").doc(bizId);

/**
 * Verifica la cookie de sesión de verdad (firma, expiración, revocación) y carga a qué negocio pertenece el usuario.
 * Firebase Auth deja registrarse a cualquiera con la API key pública: estar en Auth NO basta, hay que tener un
 * documento members/{uid} (se crea solo al registrar un negocio o al aceptar una invitación).
 */
export async function getMember(): Promise<Sesion | null> {
  const cookie = (await cookies()).get(COOKIE)?.value;
  if (!cookie) return null;
  try {
    const d = await getAuthAdmin().verifySessionCookie(cookie, true);
    const m = await getDb().collection("members").doc(d.uid).get();
    if (!m.exists) return null;
    const { bizId, rol, staffId } = m.data() as Miembro;
    const negocio = await negocioRef(bizId).get();
    if (!negocio.exists || negocio.data()?.suspendido) return null;
    return { uid: d.uid, email: d.email ?? "", nombre: d.name ?? "", bizId, rol, staffId: staffId ?? null };
  } catch {
    return null;
  }
}

/** Páginas y acciones protegidas del negocio (dueño o profesional): sin sesión válida, al login. */
export async function requireMember(): Promise<Sesion> {
  const s = await getMember();
  if (!s) redirect("/login");
  return s;
}

/** Acciones que solo puede hacer el dueño (configuración, equipo). Un profesional vuelve al panel. */
export async function requireDueno(): Promise<Sesion> {
  const s = await requireMember();
  if (s.rol !== "dueno") redirect("/panel");
  return s;
}

/** Guarda la cookie de sesión a partir de un idToken de Firebase Auth. */
export async function crearSesion(idToken: string) {
  const valor = await getAuthAdmin().createSessionCookie(idToken, { expiresIn: DURACION_MS });
  (await cookies()).set(COOKIE, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_MS / 1000,
  });
}
