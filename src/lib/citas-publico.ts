// La cita vista desde su enlace privado (/cita/<token>). El token es largo y aleatorio; en la base solo vive su hash.
import { getDb } from "./firebase-admin";
import { hashToken } from "./tokens";
import { gestionDeCita } from "./reservas";
import type { EstadoCita, Negocio } from "./types";

export type CitaPublica = {
  servicioId: string; staffId: string; servicioNombre: string; precio: number; duracionMin: number; anticipo: number;
  staffNombre: string; sedeNombre: string; sedeId: string;
  inicio: number; fin: number; estado: EstadoCita; retieneHasta?: number;
  cliente: { nombre: string; whatsapp: string; email: string };
};

export async function citaPorToken(token: string) {
  const db = getDb();
  const t = await db.collection("citaTokens").doc(hashToken(String(token))).get();
  if (!t.exists) return null;
  const { bizId, citaId } = t.data() as { bizId: string; citaId: string };
  const biz = db.collection("businesses").doc(bizId);
  const [c, n] = await Promise.all([biz.collection("appointments").doc(citaId).get(), biz.get()]);
  const cita = c.data() as CitaPublica | undefined;
  const negocio = n.data() as Negocio | undefined;
  if (!cita || !negocio) return null;
  const sede = (await biz.collection("locations").doc(cita.sedeId).get()).data() as { direccion?: string; whatsapp?: string } | undefined;
  const gestion = gestionDeCita(cita, negocio.reglas.limiteCancelarMin, Date.now());
  return { bizId, citaId, cita, negocio, gestion, direccion: sede?.direccion || negocio.direccion, whatsapp: sede?.whatsapp || negocio.whatsapp };
}
