// Carga de Firestore lo que necesita el motor de disponibilidad y lo entrega listo para llamarlo.
// No usa la sesión: lo usan el panel (vista previa) y, en la ejecución 4, la reserva pública. Siempre recibe un bizId ya resuelto en el servidor.
import { diasDisponibles, horasLibres, elegirPersonal, ocupaTiempo, type CitaOcupa, type EntradaDisp, type Hueco } from "./disponibilidad";
import { getDb } from "./firebase-admin";
import { sumarDias, zonaAUtc } from "./tiempo";
import type { Bloqueo, EstadoCita, Negocio, Personal, Servicio } from "./types";

export type Consulta = {
  servicioId: string;
  sedeId: string;
  /** Un profesional en concreto, o "cualquiera". */
  staffId: string;
  fecha: string;
  /** Cuántos días mostrar en el calendario (por defecto, la ventana de reserva del negocio + 1). */
  dias?: number;
};

export type Resultado =
  | { ok: false; error: string }
  | { ok: true; huecos: (Hueco & { asignado: string })[]; dias: string[]; personal: Record<string, string>; zona: string };

/** Lee todo lo necesario de un negocio para calcular horas libres entre `desde` y `desde + dias`. */
export async function cargarBase(bizId: string, c: Pick<Consulta, "servicioId" | "sedeId" | "staffId">, desde: string, dias: number, ahora: number) {
  const db = getDb();
  const negocioRef = db.collection("businesses").doc(bizId);
  const [nDoc, sDoc, personalSnap] = await Promise.all([negocioRef.get(), negocioRef.collection("services").doc(c.servicioId).get(), negocioRef.collection("staff").get()]);
  const negocio = nDoc.data() as Negocio | undefined;
  const servicio = sDoc.data() as Servicio | undefined;
  if (!negocio || negocio.suspendido) return { ok: false, error: "Este negocio no está disponible." } as const;
  if (!servicio || !servicio.activo || !servicio.sedes.includes(c.sedeId)) return { ok: false, error: "Ese servicio no se ofrece en esta sede." } as const;

  const personal = personalSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Personal) }))
    .filter((p) => p.activo && p.sedeId === c.sedeId && p.servicios.includes(c.servicioId) && (c.staffId === "cualquiera" || p.id === c.staffId));
  if (!personal.length) return { ok: false, error: "No hay profesionales disponibles para ese servicio." } as const;

  // Rango consultado en UTC, con un día de holgura a cada lado por las diferencias de zona.
  const desdeUtc = zonaAUtc(sumarDias(desde, -1), "00:00", negocio.zona);
  const hastaUtc = zonaAUtc(sumarDias(desde, dias + 1), "00:00", negocio.zona);
  const [bloqueosSnap, citasSnap] = await Promise.all([
    negocioRef.collection("blocks").where("fin", ">", desdeUtc).get(),
    negocioRef.collection("appointments").where("inicio", ">=", desdeUtc).where("inicio", "<", hastaUtc).get(),
  ]);
  const bloqueos = bloqueosSnap.docs.map((d) => d.data() as Bloqueo).filter((b) => b.inicio < hastaUtc);
  const citas: CitaOcupa[] = citasSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as { staffId: string; inicio: number; fin: number; estado: EstadoCita; retieneHasta?: number | null }) }))
    .filter((c) => ocupaTiempo(c, ahora))
    .map(({ id, staffId, inicio, fin }) => ({ id, staffId, inicio, fin }));

  const base: Omit<EntradaDisp, "fecha"> = {
    ahora, zona: negocio.zona, reglas: negocio.reglas, duracionMin: servicio.duracionMin,
    personal: personal.map((p) => ({ id: p.id, sedeId: p.sedeId, horario: p.horario })), bloqueos, citas,
  };
  return { ok: true, base, nombres: Object.fromEntries(personal.map((p) => [p.id, p.nombre])), negocio } as const;
}

/** Horas libres de un día + días con cupo, y a quién se asignaría cada hora si el cliente elige "cualquiera". */
export async function consultar(bizId: string, c: Consulta, ahora = Date.now()): Promise<Resultado> {
  const cargado = await cargarBase(bizId, c, c.fecha, c.dias ?? 31, ahora);
  if (!cargado.ok) return { ok: false, error: cargado.error };
  const { base, nombres, negocio } = cargado;
  const huecos = horasLibres({ ...base, fecha: c.fecha }).map((h) => ({ ...h, asignado: elegirPersonal(h.staffIds, base.citas, c.fecha, base.zona) }));
  const dias = diasDisponibles(base, c.fecha, c.dias ?? Math.min(negocio.reglas.ventanaDias + 1, 60));
  return { ok: true, huecos, dias, personal: nombres, zona: base.zona };
}
