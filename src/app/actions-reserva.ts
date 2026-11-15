"use server";

import { randomBytes } from "node:crypto";
import { elegirPersonal, horasLibres, ocupaTiempo } from "@/lib/disponibilidad";
import { cargarBase, consultar, type Resultado } from "@/lib/disponibilidad-datos";
import { marcarReservada } from "@/lib/espera";
import { getDb } from "@/lib/firebase-admin";
import { negocioPorSlug } from "@/lib/publico";
import { hashToken } from "@/lib/tokens";
import { anticipoDe, clavesDeCandado, MINUTOS_RETENCION } from "@/lib/reservas";
import { esFecha, esHora, zonaAUtc } from "@/lib/tiempo";
import type { EstadoCita, Servicio } from "@/lib/types";
import { validarCliente } from "@/lib/validaciones";

export type EntradaConsulta = { servicioId: string; sedeId: string; staffId: string; fecha: string };
export type EntradaReserva = EntradaConsulta & { hora: string; cliente: { nombre: string; whatsapp: string; email: string }; trampa?: string };
export type ResReserva = { ok: true; token: string } | { ok: false; error: string };

const MAX_CITAS_ACTIVAS_POR_WHATSAPP = 3;
const fallo = (error: string) => ({ ok: false as const, error });
class Conflicto extends Error {}

/** Horas libres y días con cupo para el cliente. Público: el negocio sale del enlace, no de una sesión. */
export async function horasPublicas(slug: string, c: EntradaConsulta): Promise<Resultado> {
  const r = await negocioPorSlug(String(slug));
  if (!r) return { ok: false, error: "No encontramos este negocio." };
  if (!esFecha(c.fecha)) return { ok: false, error: "La fecha no es válida." };
  return consultar(r.bizId, { servicioId: String(c.servicioId), sedeId: String(c.sedeId), staffId: String(c.staffId), fecha: c.fecha });
}

/**
 * Reserva una cita. Nunca confía en el cliente: vuelve a calcular la disponibilidad, elige al profesional si el cliente
 * dijo "cualquiera" y crea la cita junto con sus candados en una transacción (dos clientes no pueden tener la misma hora).
 */
export async function reservar(slug: string, e: EntradaReserva): Promise<ResReserva> {
  if (e.trampa) return fallo("No pudimos completar la reserva. Intenta de nuevo."); // campo oculto que solo llenan los bots
  const negocio = await negocioPorSlug(String(slug));
  if (!negocio) return fallo("No encontramos este negocio.");
  const { bizId } = negocio;
  if (!esFecha(e.fecha) || !esHora(e.hora)) return fallo("Elige una fecha y una hora.");
  const cli = validarCliente(e.cliente);
  if ("error" in cli) return fallo(cli.error);
  const cliente = cli.valor;

  const db = getDb();
  const bizRef = db.collection("businesses").doc(bizId);
  const ahora = Date.now();

  // Freno de abuso: pocas citas futuras abiertas por número de WhatsApp.
  const previas = await bizRef.collection("appointments").where("cliente.whatsapp", "==", cliente.whatsapp).get();
  const abiertas = previas.docs.filter((d) => {
    const c = d.data() as { estado: EstadoCita; retieneHasta?: number; fin: number };
    return c.fin > ahora && ocupaTiempo(c, ahora);
  });
  if (abiertas.length >= MAX_CITAS_ACTIVAS_POR_WHATSAPP) return fallo(`Ya tienes ${MAX_CITAS_ACTIVAS_POR_WHATSAPP} citas pendientes en este negocio. Cancela una o espera a que pase.`);

  for (let intento = 0; intento < 3; intento++) {
    const cargado = await cargarBase(bizId, { servicioId: String(e.servicioId), sedeId: String(e.sedeId), staffId: String(e.staffId) }, e.fecha, 1, ahora);
    if (!cargado.ok) return fallo(cargado.error);
    const { base, nombres, negocio: n } = cargado;
    const inicio = zonaAUtc(e.fecha, e.hora, base.zona);
    const hueco = horasLibres({ ...base, fecha: e.fecha }).find((h) => h.inicio === inicio);
    if (!hueco) return fallo("Esa hora ya no está disponible. Elige otra.");
    const staffId = e.staffId === "cualquiera" ? elegirPersonal(hueco.staffIds, base.citas, e.fecha, base.zona) : e.staffId;

    const servicio = (await bizRef.collection("services").doc(e.servicioId).get()).data() as Servicio;
    const sede = (await bizRef.collection("locations").doc(e.sedeId).get()).data() as { nombre: string };
    const anticipo = anticipoDe(servicio);
    const estado: EstadoCita = anticipo > 0 ? "pendiente_pago" : "confirmada";
    const fin = inicio + servicio.duracionMin * 60_000;
    const token = randomBytes(24).toString("base64url");
    const citaRef = bizRef.collection("appointments").doc();
    const refs = clavesDeCandado(staffId, inicio, fin, n.reglas.margenMin).map((k) => bizRef.collection("locks").doc(k));

    try {
      await db.runTransaction(async (t) => {
        // Primero se lee todo: ¿alguno de los candados está tomado por una cita que de verdad ocupa la hora?
        const snaps = await t.getAll(...refs);
        const vistas = new Map<string, boolean>();
        for (const s of snaps) {
          if (!s.exists) continue;
          const citaId = s.data()!.citaId as string;
          if (!vistas.has(citaId)) {
            const c = await t.get(bizRef.collection("appointments").doc(citaId));
            // un candado "viejo" (cita cancelada o con el pago vencido) no cuenta: se sobrescribe
            vistas.set(citaId, c.exists && ocupaTiempo(c.data() as { estado: EstadoCita; retieneHasta?: number }, ahora));
          }
          if (vistas.get(citaId)) throw new Conflicto();
        }
        t.set(citaRef, {
          servicioId: e.servicioId, servicioNombre: servicio.nombre, precio: servicio.precio, duracionMin: servicio.duracionMin, anticipo,
          staffId, staffNombre: nombres[staffId] ?? "", sedeId: e.sedeId, sedeNombre: sede.nombre,
          inicio, fin, cliente, estado, ...(estado === "pendiente_pago" ? { retieneHasta: ahora + MINUTOS_RETENCION * 60_000 } : {}),
          origen: "web", avisos: {}, creado: ahora,
        });
        for (const r of refs) t.set(r, { citaId: citaRef.id, staffId });
        t.set(db.collection("citaTokens").doc(hashToken(token)), { bizId, citaId: citaRef.id, creado: ahora });
      });
    } catch (err) {
      if (err instanceof Conflicto) continue; // alguien se la ganó: se recalcula (con "cualquiera" puede haber otro libre)
      console.error("reservar", err);
      return fallo("No pudimos guardar tu reserva. Intenta de nuevo.");
    }
    // si estaba en la lista de espera de ese día, ya no hace falta avisarle más
    await marcarReservada(bizId, { whatsapp: cliente.whatsapp, servicioId: e.servicioId, sedeId: e.sedeId, fecha: e.fecha }).catch((err) => console.error("marcarReservada", err));
    return { ok: true, token };
  }
  return fallo("Esa hora acaba de ser reservada por otra persona. Elige otra.");
}
