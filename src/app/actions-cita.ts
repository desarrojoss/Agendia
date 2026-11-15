"use server";

// Lo que el cliente hace con su cita SIN cuenta (el token del enlace es su llave) y la lista de espera.
// Igual que al reservar: nada se confía al navegador; se vuelve a validar todo y los candados deciden quién gana.
import { horasLibres, hoyLocal, ocupaTiempo } from "@/lib/disponibilidad";
import { cargarBase, consultar, type Resultado } from "@/lib/disponibilidad-datos";
import { citaPorToken } from "@/lib/citas-publico";
import { ESPERA_ABIERTA, marcarEspera } from "@/lib/espera";
import { getDb } from "@/lib/firebase-admin";
import { negocioPorSlug } from "@/lib/publico";
import { clavesDeCandado, gestionDeCita } from "@/lib/reservas";
import { esFecha, esHora, sumarDias, zonaAUtc } from "@/lib/tiempo";
import type { EstadoCita } from "@/lib/types";
import { validarCliente } from "@/lib/validaciones";

type Ok = { ok: true } | { ok: false; error: string };
const fallo = (error: string) => ({ ok: false as const, error });
class Rechazo extends Error {}
const MAX_ESPERAS_POR_WHATSAPP = 5;

/** Cancelar. Solo hasta el límite del negocio (una cita con anticipo sin pagar, mientras no haya empezado). */
export async function cancelarCita(token: string): Promise<Ok> {
  const r = await citaPorToken(String(token));
  if (!r) return fallo("No encontramos tu cita.");
  const ref = getDb().collection("businesses").doc(r.bizId).collection("appointments").doc(r.citaId);
  const ahora = Date.now();
  try {
    await getDb().runTransaction(async (t) => {
      const c = (await t.get(ref)).data() as { estado: EstadoCita; inicio: number } | undefined;
      if (!c || !gestionDeCita(c, r.negocio.reglas.limiteCancelarMin, ahora).cancelar) throw new Rechazo();
      t.update(ref, { estado: "cancelada", canceladaPor: "cliente", canceladaEn: ahora });
    });
  } catch (e) {
    if (e instanceof Rechazo) return fallo("Esta cita ya no se puede cancelar desde aquí. Escríbele al negocio.");
    console.error("cancelarCita", e);
    return fallo("No pudimos cancelar. Intenta de nuevo.");
  }
  await marcarEspera(r.bizId, r.cita, ahora).catch((e) => console.error("marcarEspera", e)); // la cancelación ya quedó; el aviso es de buena fe
  return { ok: true };
}

/** Horas libres para mover la cita: mismo servicio, sede y profesional; la cita no se estorba a sí misma. */
export async function horasReprogramar(token: string, fecha: string): Promise<Resultado> {
  const r = await citaPorToken(String(token));
  if (!r || !r.gestion.reprogramar) return { ok: false, error: "Esta cita ya no se puede cambiar desde aquí." };
  if (!esFecha(fecha)) return { ok: false, error: "La fecha no es válida." };
  return consultar(r.bizId, { servicioId: r.cita.servicioId, sedeId: r.cita.sedeId, staffId: r.cita.staffId, fecha, ignorarCitaId: r.citaId });
}

/** Mover la cita a otra hora: en una transacción toma los candados nuevos y suelta los viejos. */
export async function reprogramarCita(token: string, fecha: string, hora: string): Promise<Ok> {
  const r = await citaPorToken(String(token));
  if (!r || !r.gestion.reprogramar) return fallo("Esta cita ya no se puede cambiar desde aquí. Escríbele al negocio.");
  if (!esFecha(fecha) || !esHora(hora)) return fallo("Elige una fecha y una hora.");
  const { bizId, citaId, cita } = r;
  const ahora = Date.now();
  const cargado = await cargarBase(bizId, { servicioId: cita.servicioId, sedeId: cita.sedeId, staffId: cita.staffId }, fecha, 1, ahora);
  if (!cargado.ok) return fallo(cargado.error);
  const { base, negocio } = cargado;
  const inicio = zonaAUtc(fecha, hora, base.zona);
  if (!horasLibres({ ...base, fecha, ignorarCitaId: citaId }).some((h) => h.inicio === inicio)) return fallo("Esa hora ya no está disponible. Elige otra.");
  if (inicio === cita.inicio) return fallo("Esa ya es la hora de tu cita.");

  const db = getDb();
  const biz = db.collection("businesses").doc(bizId);
  const citaRef = biz.collection("appointments").doc(citaId);
  const duracionMin = base.duracionMin;
  const fin = inicio + duracionMin * 60_000;
  const margen = negocio.reglas.margenMin;
  const nuevas = clavesDeCandado(cita.staffId, inicio, fin, margen);
  const viejas = clavesDeCandado(cita.staffId, cita.inicio, cita.fin, margen);
  try {
    await db.runTransaction(async (t) => {
      const actual = (await t.get(citaRef)).data() as { estado: EstadoCita; inicio: number } | undefined;
      if (!actual || !gestionDeCita(actual, negocio.reglas.limiteCancelarMin, ahora).reprogramar) throw new Rechazo("estado");
      const snaps = await t.getAll(...nuevas.map((k) => biz.collection("locks").doc(k)));
      const vistas = new Map<string, boolean>();
      for (const s of snaps) {
        if (!s.exists) continue;
        const otra = s.data()!.citaId as string;
        if (otra === citaId) continue; // un candado de esta misma cita (el horario nuevo se cruza con el viejo)
        if (!vistas.has(otra)) {
          const c = await t.get(biz.collection("appointments").doc(otra));
          vistas.set(otra, c.exists && ocupaTiempo(c.data() as { estado: EstadoCita; retieneHasta?: number }, ahora));
        }
        if (vistas.get(otra)) throw new Rechazo("ocupada");
      }
      for (const k of viejas) if (!nuevas.includes(k)) t.delete(biz.collection("locks").doc(k));
      for (const k of nuevas) t.set(biz.collection("locks").doc(k), { citaId, staffId: cita.staffId });
      t.update(citaRef, { inicio, fin, duracionMin, inicioAnterior: cita.inicio, reprogramadaEn: ahora, avisos: {} });
    });
  } catch (e) {
    if (e instanceof Rechazo) return fallo(e.message === "ocupada" ? "Esa hora acaba de ser reservada por otra persona. Elige otra." : "Esta cita ya no se puede cambiar desde aquí. Escríbele al negocio.");
    console.error("reprogramarCita", e);
    return fallo("No pudimos cambiar la hora. Intenta de nuevo.");
  }
  await marcarEspera(bizId, { sedeId: cita.sedeId, inicio: cita.inicio }, ahora).catch((e) => console.error("marcarEspera", e)); // la hora vieja quedó libre
  return { ok: true };
}

export type EntradaEspera = { servicioId: string; sedeId: string; fecha: string; cliente: { nombre: string; whatsapp: string; email: string }; trampa?: string };

/** "Avisarme si se libera algo": solo si ese día de verdad no tiene horas (si tiene, se le pide que reserve). */
export async function unirseListaEspera(slug: string, e: EntradaEspera): Promise<Ok> {
  if (e.trampa) return fallo("No pudimos guardar tu aviso. Intenta de nuevo.");
  const negocio = await negocioPorSlug(String(slug));
  if (!negocio) return fallo("No encontramos este negocio.");
  if (!esFecha(e.fecha)) return fallo("Elige el día que quieres.");
  const cli = validarCliente(e.cliente);
  if ("error" in cli) return fallo(cli.error);
  const { bizId } = negocio;
  const hoy = hoyLocal(negocio.negocio.zona);
  if (e.fecha < hoy || e.fecha > sumarDias(hoy, negocio.negocio.reglas.ventanaDias)) return fallo("Ese día está fuera del rango en que se puede reservar.");

  const r = await consultar(bizId, { servicioId: String(e.servicioId), sedeId: String(e.sedeId), staffId: "cualquiera", fecha: e.fecha, dias: 1 });
  if (!r.ok) return fallo(r.error);
  if (r.huecos.length > 0) return fallo("Ese día todavía tiene horas libres: elígelas arriba y reserva.");

  const col = getDb().collection("businesses").doc(bizId).collection("waitlist");
  const mias = (await col.where("cliente.whatsapp", "==", cli.valor.whatsapp).get()).docs.filter((d) => ESPERA_ABIERTA.includes(d.data().estado) && d.data().fecha >= hoy);
  if (mias.some((d) => d.data().servicioId === e.servicioId && d.data().sedeId === e.sedeId && d.data().fecha === e.fecha)) return { ok: true }; // ya estaba: nada que repetir
  if (mias.length >= MAX_ESPERAS_POR_WHATSAPP) return fallo(`Ya tienes ${MAX_ESPERAS_POR_WHATSAPP} avisos activos en este negocio.`);
  await col.add({ servicioId: e.servicioId, sedeId: e.sedeId, fecha: e.fecha, cliente: cli.valor, estado: "esperando", avisos: {}, creado: Date.now() });
  return { ok: true };
}
