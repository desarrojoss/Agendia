"use server";

import { randomBytes } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { negocioRef, requireDueno } from "@/lib/auth-server";
import { carpetaImagenes, getNegocio, imagenValida, listarPersonal, listarServicios, listarSedes } from "@/lib/datos";
import { getDb } from "@/lib/firebase-admin";
import { errorDeSlug } from "@/lib/slug";
import type { Bloqueo, Personal, Sede, Servicio } from "@/lib/types";
import { validarBloqueo, validarNegocio, validarPersonal, validarSede, validarServicio, type EntradaBloqueo } from "@/lib/validaciones";

export type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fallo = (error: string) => ({ ok: false as const, error });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** Firma para subir una imagen directo desde el navegador a Cloudinary (el secreto nunca sale del servidor). La carpeta es del negocio. */
export async function firmarSubida(destino: "logo" | "personal") {
  const s = await requireDueno();
  const folder = `${carpetaImagenes(s.bizId)}/${destino}`;
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, process.env.CLOUDINARY_API_SECRET!);
  return { cloudName: process.env.CLOUDINARY_CLOUD_NAME!, apiKey: process.env.CLOUDINARY_API_KEY!, timestamp, folder, signature };
}

// ---------- Sedes ----------
export async function guardarSede(id: string | null, entrada: Partial<Sede>): Promise<Res<{ id: string }>> {
  const s = await requireDueno();
  const v = validarSede(entrada);
  if ("error" in v) return fallo(v.error);
  const col = negocioRef(s.bizId).collection("locations");
  const todas = await listarSedes(s.bizId);
  if (id) {
    if (!todas.some((x) => x.id === id)) return fallo("Esa sede ya no existe.");
    if (!v.valor.activo && !todas.some((x) => x.id !== id && x.activo)) return fallo("Debe quedar al menos una sede activa.");
    await col.doc(id).update(v.valor);
    return { ok: true, id };
  }
  const ref = col.doc();
  await ref.set({ ...v.valor, orden: todas.length });
  return { ok: true, id: ref.id };
}

// ---------- Servicios ----------
export async function guardarServicio(id: string | null, entrada: Partial<Servicio>): Promise<Res<{ id: string }>> {
  const s = await requireDueno();
  const sedes = await listarSedes(s.bizId);
  const v = validarServicio(entrada, sedes.map((x) => x.id));
  if ("error" in v) return fallo(v.error);
  const col = negocioRef(s.bizId).collection("services");
  if (id) {
    if (!(await col.doc(id).get()).exists) return fallo("Ese servicio ya no existe.");
    await col.doc(id).update(v.valor);
    return { ok: true, id };
  }
  const todos = await listarServicios(s.bizId);
  const ref = col.doc();
  await ref.set({ ...v.valor, orden: (todos.at(-1)?.orden ?? -1) + 1 });
  return { ok: true, id: ref.id };
}

export async function alternarServicio(id: string): Promise<Res> {
  const s = await requireDueno();
  const ref = negocioRef(s.bizId).collection("services").doc(id);
  const d = await ref.get();
  if (!d.exists) return fallo("Ese servicio ya no existe.");
  await ref.update({ activo: !d.data()!.activo });
  return { ok: true };
}

/** Sube o baja un servicio en la lista (intercambia su orden con el vecino). */
export async function moverServicio(id: string, dir: -1 | 1): Promise<Res> {
  const s = await requireDueno();
  const lista = await listarServicios(s.bizId);
  const i = lista.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= lista.length) return { ok: true };
  const col = negocioRef(s.bizId).collection("services");
  const b = getDb().batch();
  // se renumera toda la lista para que el orden nunca quede repetido
  const nueva = [...lista];
  [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
  nueva.forEach((x, n) => b.update(col.doc(x.id), { orden: n }));
  await b.commit();
  return { ok: true };
}

// ---------- Personal ----------
export async function guardarPersonal(id: string | null, entrada: Partial<Personal>): Promise<Res<{ id: string }>> {
  const s = await requireDueno();
  const [sedes, servicios] = await Promise.all([listarSedes(s.bizId), listarServicios(s.bizId)]);
  const v = validarPersonal(entrada, { sedes: sedes.map((x) => x.id), servicios: servicios.map((x) => x.id), imagenValida: imagenValida(s.bizId) });
  if ("error" in v) return fallo(v.error);
  const col = negocioRef(s.bizId).collection("staff");
  if (id) {
    if (!(await col.doc(id).get()).exists) return fallo("Esa persona ya no existe.");
    await col.doc(id).update(v.valor);
    return { ok: true, id };
  }
  const ref = col.doc();
  // icsToken: secreto de la suscripción a su agenda desde Google Calendar o el iPhone (ejecución 7)
  await ref.set({ ...v.valor, uid: null, icsToken: randomBytes(16).toString("hex") });
  return { ok: true, id: ref.id };
}

export async function alternarPersonal(id: string): Promise<Res> {
  const s = await requireDueno();
  const ref = negocioRef(s.bizId).collection("staff").doc(id);
  const d = await ref.get();
  if (!d.exists) return fallo("Esa persona ya no existe.");
  const p = d.data() as Personal;
  if (!p.activo && Object.values(p.horario).every((t) => !t.length)) return fallo("Antes de activarla, agrégale un horario de trabajo.");
  await ref.update({ activo: !p.activo });
  return { ok: true };
}

// ---------- Bloqueos ----------
export async function crearBloqueo(entrada: EntradaBloqueo): Promise<Res<{ id: string }>> {
  const s = await requireDueno();
  const [negocio, sedes, personal] = await Promise.all([getNegocio(s.bizId), listarSedes(s.bizId), listarPersonal(s.bizId)]);
  const v = validarBloqueo(entrada, { sedes: sedes.map((x) => x.id), personal: personal.map((x) => x.id), zona: negocio.zona });
  if ("error" in v) return fallo(v.error);
  const ref = negocioRef(s.bizId).collection("blocks").doc();
  await ref.set(v.valor satisfies Bloqueo);
  return { ok: true, id: ref.id };
}

export async function eliminarBloqueo(id: string): Promise<Res> {
  const s = await requireDueno();
  await negocioRef(s.bizId).collection("blocks").doc(id).delete();
  return { ok: true };
}

// ---------- Negocio (datos, reglas y enlace) ----------
export async function guardarNegocio(entrada: {
  nombre?: string; slug?: string; whatsapp?: string; direccion?: string; logoUrl?: string | null; reglas?: Record<string, unknown>;
}): Promise<Res<{ slug: string }>> {
  const s = await requireDueno();
  const v = validarNegocio(entrada, imagenValida(s.bizId));
  if ("error" in v) return fallo(v.error);
  const db = getDb();
  const ref = negocioRef(s.bizId);
  const actual = (await getNegocio(s.bizId)).slug;
  const slug = String(entrada.slug ?? actual).trim();
  const motivo = slug === actual ? null : errorDeSlug(slug);
  if (motivo) return fallo(motivo);
  try {
    await db.runTransaction(async (t) => {
      if (slug !== actual) {
        const nuevo = db.collection("slugs").doc(slug);
        if ((await t.get(nuevo)).exists) throw new Error("SLUG_OCUPADO");
        t.set(nuevo, { bizId: s.bizId });
        t.delete(db.collection("slugs").doc(actual));
      }
      t.update(ref, { ...v.valor, slug });
    });
  } catch (e) {
    if ((e as Error).message === "SLUG_OCUPADO") return fallo("Ese enlace ya lo usa otro negocio.");
    console.error("guardarNegocio", e);
    return fallo("No pudimos guardar los cambios. Intenta de nuevo.");
  }
  return { ok: true, slug };
}
