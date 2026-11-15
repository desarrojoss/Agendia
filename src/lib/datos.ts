// Lecturas de la configuración de un negocio. Siempre reciben el bizId de la SESIÓN (requireMember), nunca uno del cliente.
import { negocioRef } from "./auth-server";
import type { Bloqueo, Con, Negocio, Personal, Sede, Servicio } from "./types";

async function listar<T extends { orden?: number; nombre?: string }>(bizId: string, coleccion: string): Promise<Con<T>[]> {
  const snap = await negocioRef(bizId).collection(coleccion).get();
  const filas = snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
  return filas.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"));
}

export const getNegocio = async (bizId: string) => (await negocioRef(bizId).get()).data() as Negocio;
export const listarSedes = (bizId: string) => listar<Sede>(bizId, "locations");
export const listarServicios = (bizId: string) => listar<Servicio>(bizId, "services");
export const listarPersonal = (bizId: string) => listar<Personal>(bizId, "staff");

/** Bloqueos que aún no terminaron, del más próximo al más lejano. */
export async function listarBloqueos(bizId: string): Promise<Con<Bloqueo>[]> {
  const snap = await negocioRef(bizId).collection("blocks").where("fin", ">", Date.now()).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Bloqueo) })).sort((a, b) => a.inicio - b.inicio);
}

/** Cloudinary: todas las imágenes de un negocio viven en agendia/<bizId>/ y solo se aceptan de ahí. */
export const carpetaImagenes = (bizId: string) => `agendia/${bizId}`;
export const imagenValida = (bizId: string) => (u: string) =>
  new RegExp(`^https://res\\.cloudinary\\.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/(v\\d+/)?${carpetaImagenes(bizId)}/`).test(u);
