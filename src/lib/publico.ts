// Lo que ve cualquier visitante de la página pública de un negocio. Solo datos públicos: sin correos, tokens ni ids de usuario.
import { getDb } from "./firebase-admin";
import type { Anticipo, Negocio, Personal, Sede, Servicio } from "./types";

export type PublicoSede = { id: string; nombre: string; direccion: string };
export type PublicoServicio = { id: string; nombre: string; descripcion: string; duracionMin: number; precio: number; anticipo: Anticipo; sedes: string[] };
export type PublicoPersonal = { id: string; nombre: string; fotoUrl: string | null; sedeId: string; servicios: string[] };
export type PublicoNegocio = { nombre: string; slug: string; logoUrl: string | null; direccion: string; whatsapp: string; zona: string };

/** Busca un negocio por su enlace. Un negocio suspendido no existe para el público. */
export async function negocioPorSlug(slug: string): Promise<{ bizId: string; negocio: Negocio } | null> {
  const db = getDb();
  const s = await db.collection("slugs").doc(slug).get();
  if (!s.exists) return null;
  const bizId = s.data()!.bizId as string;
  const n = await db.collection("businesses").doc(bizId).get();
  const negocio = n.data() as Negocio | undefined;
  return negocio && !negocio.suspendido ? { bizId, negocio } : null;
}

export const vistaPublica = (n: Negocio): PublicoNegocio => ({ nombre: n.nombre, slug: n.slug, logoUrl: n.logoUrl, direccion: n.direccion, whatsapp: n.whatsapp, zona: n.zona });

/** Sedes, servicios y profesionales activos, ordenados como los acomodó el dueño. */
export async function datosPublicos(bizId: string) {
  const ref = getDb().collection("businesses").doc(bizId);
  const [sedesSnap, serviciosSnap, personalSnap] = await Promise.all([ref.collection("locations").get(), ref.collection("services").get(), ref.collection("staff").get()]);
  const porOrden = <T extends { orden?: number; nombre: string }>(a: T, b: T) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre, "es");
  const sedes: PublicoSede[] = sedesSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Sede) }))
    .filter((s) => s.activo)
    .sort(porOrden)
    .map(({ id, nombre, direccion }) => ({ id, nombre, direccion }));
  const servicios: PublicoServicio[] = serviciosSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Servicio) }))
    .filter((s) => s.activo)
    .sort(porOrden)
    .map(({ id, nombre, descripcion, duracionMin, precio, anticipo, sedes }) => ({ id, nombre, descripcion, duracionMin, precio, anticipo, sedes }));
  const personal: PublicoPersonal[] = personalSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Personal) }))
    .filter((p) => p.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map(({ id, nombre, fotoUrl, sedeId, servicios }) => ({ id, nombre, fotoUrl, sedeId, servicios }));
  return { sedes, servicios, personal };
}
