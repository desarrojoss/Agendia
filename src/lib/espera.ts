// Lista de espera: quien no encontró hora deja su aviso (businesses/{biz}/waitlist). Cuando una cita se cancela o se mueve y
// el día vuelve a tener cupo, esas personas quedan marcadas "hueco_libre" con la hora y el enlace directo. El envío del
// correo y del WhatsApp lo hace la ejecución 8 (campo `avisos`, idempotente); aquí solo se decide a quién y cuándo.
import { consultar } from "./disponibilidad-datos";
import { getDb } from "./firebase-admin";
import { utcAZona } from "./tiempo";
import type { Negocio } from "./types";

export const ESPERA_ABIERTA = ["esperando", "hueco_libre"];

/** Una cita acaba de liberar su hora. Marca a quienes esperaban ese día, ese servicio y esa sede, si de verdad quedó un hueco. */
export async function marcarEspera(bizId: string, libre: { sedeId: string; inicio: number }, ahora = Date.now()): Promise<number> {
  const biz = getDb().collection("businesses").doc(bizId);
  const negocio = (await biz.get()).data() as Negocio | undefined;
  if (!negocio) return 0;
  const fecha = utcAZona(libre.inicio, negocio.zona).fecha;
  const snap = await biz.collection("waitlist").where("sedeId", "==", libre.sedeId).where("fecha", "==", fecha).get();
  const abiertas = snap.docs.filter((d) => ESPERA_ABIERTA.includes(d.data().estado));
  let marcadas = 0;
  for (const servicioId of new Set(abiertas.map((d) => d.data().servicioId as string))) {
    const r = await consultar(bizId, { servicioId, sedeId: libre.sedeId, staffId: "cualquiera", fecha }, ahora);
    if (!r.ok || r.huecos.length === 0) continue;
    const hora = (r.huecos.find((h) => h.inicio === libre.inicio) ?? r.huecos[0]).hora;
    for (const d of abiertas.filter((x) => x.data().servicioId === servicioId)) {
      await d.ref.update({ estado: "hueco_libre", hueco: { fecha, hora, en: ahora }, avisos: {} });
      marcadas++;
    }
  }
  return marcadas;
}

/** El cliente reservó: sus avisos abiertos de ese servicio, sede y día pasan a "reservado". */
export async function marcarReservada(bizId: string, q: { whatsapp: string; servicioId: string; sedeId: string; fecha: string }): Promise<void> {
  const snap = await getDb().collection("businesses").doc(bizId).collection("waitlist").where("cliente.whatsapp", "==", q.whatsapp).get();
  for (const d of snap.docs) {
    const w = d.data();
    if (ESPERA_ABIERTA.includes(w.estado) && w.servicioId === q.servicioId && w.sedeId === q.sedeId && w.fecha === q.fecha) await d.ref.update({ estado: "reservado" });
  }
}
