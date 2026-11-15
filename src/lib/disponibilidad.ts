// Motor de disponibilidad: calcula qué horas puede reservar un cliente. Lógica PURA (no importa Firebase ni Next):
// recibe los datos ya cargados y devuelve las horas libres. Se prueba con node --test (disponibilidad.test.ts).
//
// Reglas (todas se aplican a la vez):
//  - Horario: solo dentro de los tramos del día de la semana de cada profesional (las pausas son los huecos entre tramos).
//  - Duración: la cita completa debe caber en el tramo. Las horas se ofrecen cada `intervaloMin`, contadas desde el inicio del tramo.
//  - Citas: un profesional no atiende dos a la vez; entre una cita y otra se deja `margenMin`.
//  - Bloqueos: del negocio entero, de una sede o de una persona. Terminar justo cuando empieza un bloqueo SÍ se permite.
//  - Anticipación: la hora debe empezar al menos `anticipacionMin` después de "ahora".
//  - Ventana: no se reserva más allá de hoy + `ventanaDias`, ni en días pasados.
//  - Zona horaria: "hoy", el día de la semana y los tramos se miran en la zona del negocio; todo se guarda en UTC.
import { DIAS, hhmmAMin, minAHhmm, sumarDias, utcAZona, zonaAUtc, type Dia } from "./tiempo.ts";
import type { Bloqueo, EstadoCita, Horario, Reglas } from "./types.ts";

export type PersonaDisp = { id: string; sedeId: string; horario: Horario };
/** Una cita que ocupa tiempo (confirmada o pendiente de pago con la hora retenida). Las canceladas no se pasan. */
export type CitaOcupa = { id?: string; staffId: string; inicio: number; fin: number };

export type EntradaDisp = {
  ahora: number; // ms UTC
  zona: string; // ej. "America/Bogota"
  reglas: Reglas;
  duracionMin: number;
  fecha: string; // día que se consulta, "YYYY-MM-DD" en la zona del negocio
  personal: PersonaDisp[]; // ya filtrado: activos, de la sede y que ofrecen el servicio
  bloqueos: Bloqueo[];
  citas: CitaOcupa[];
  /** Al reprogramar, la cita que se mueve no debe estorbarse a sí misma. */
  ignorarCitaId?: string;
};

/** Una hora de inicio ofrecida y quiénes están libres a esa hora. */
export type Hueco = { hora: string; inicio: number; fin: number; staffIds: string[] };

const MIN = 60_000;

/** Día de la semana de una fecha de calendario (lunes primero). */
export function diaDeFecha(fecha: string): Dia {
  const [y, m, d] = fecha.split("-").map(Number);
  return DIAS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
}

/** La fecha de hoy en la zona del negocio (puede ser distinta a la fecha UTC). */
export const hoyEnZona = (ahora: number, zona: string) => utcAZona(ahora, zona).fecha;

/** Lo mismo con el reloj actual (para páginas del servidor). */
export const hoyLocal = (zona: string) => hoyEnZona(Date.now(), zona);

/** ¿Este bloqueo le afecta a esta persona? Persona: solo el suyo. Sede: las personas de esa sede. Negocio: todos. */
const aplicaBloqueo = (b: Bloqueo, p: PersonaDisp) => (b.staffId ? b.staffId === p.id : b.sedeId ? b.sedeId === p.sedeId : true);

export function horasLibres(e: EntradaDisp): Hueco[] {
  const hoy = hoyEnZona(e.ahora, e.zona);
  if (e.fecha < hoy || e.fecha > sumarDias(hoy, e.reglas.ventanaDias)) return [];

  const dia = diaDeFecha(e.fecha);
  const duracion = e.duracionMin * MIN;
  const margen = e.reglas.margenMin * MIN;
  const minimo = e.ahora + e.reglas.anticipacionMin * MIN;
  const porInicio = new Map<number, string[]>();

  for (const p of e.personal) {
    const bloqueos = e.bloqueos.filter((b) => aplicaBloqueo(b, p));
    const citas = e.citas.filter((c) => c.staffId === p.id && (!e.ignorarCitaId || c.id !== e.ignorarCitaId));
    for (const [desde, hasta] of p.horario[dia] ?? []) {
      const fin = hhmmAMin(hasta);
      for (let m = hhmmAMin(desde); m * MIN + duracion <= fin * MIN; m += e.reglas.intervaloMin) {
        const inicio = zonaAUtc(e.fecha, minAHhmm(m), e.zona);
        const final = inicio + duracion;
        if (inicio < minimo) continue;
        if (bloqueos.some((b) => inicio < b.fin && final > b.inicio)) continue;
        if (citas.some((c) => inicio < c.fin + margen && final + margen > c.inicio)) continue;
        porInicio.set(inicio, [...(porInicio.get(inicio) ?? []), p.id]);
      }
    }
  }

  return [...porInicio.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([inicio, staffIds]) => ({ hora: utcAZona(inicio, e.zona).hora, inicio, fin: inicio + duracion, staffIds }));
}

/** Los días (desde `desde`, `cuantos` seguidos) que tienen al menos una hora libre: para pintar el calendario de reserva. */
export function diasDisponibles(base: Omit<EntradaDisp, "fecha">, desde: string, cuantos: number): string[] {
  const dias: string[] = [];
  for (let i = 0; i < cuantos; i++) {
    const fecha = sumarDias(desde, i);
    if (horasLibres({ ...base, fecha }).length) dias.push(fecha);
  }
  return dias;
}

/**
 * Para "cualquier profesional": entre los que están libres, el que tiene menos citas ese día (reparte la carga).
 * Si hay empate, el primero de la lista, para que el resultado sea siempre el mismo.
 */
export function elegirPersonal(staffIds: string[], citas: CitaOcupa[], fecha: string, zona: string, ignorarCitaId?: string): string {
  const cuenta = (id: string) => citas.filter((c) => c.staffId === id && (!ignorarCitaId || c.id !== ignorarCitaId) && utcAZona(c.inicio, zona).fecha === fecha).length;
  return staffIds.reduce((mejor, id) => (cuenta(id) < cuenta(mejor) ? id : mejor), staffIds[0]);
}

/** Revalidación al reservar: ¿esa hora sigue libre para esa persona? (el cliente pudo tardar y alguien se la ganó). */
export function sigueLibre(e: EntradaDisp, inicio: number, staffId: string): boolean {
  return horasLibres(e).some((h) => h.inicio === inicio && h.staffIds.includes(staffId));
}

/**
 * ¿Esta cita ocupa tiempo? Todas salvo las canceladas; y una "pendiente de pago" solo mientras dure la retención
 * (si el cliente no paga a tiempo, la hora se libera sola sin que nadie tenga que hacer nada).
 */
export function ocupaTiempo(c: { estado: EstadoCita; retieneHasta?: number | null }, ahora: number): boolean {
  if (c.estado === "cancelada") return false;
  if (c.estado === "pendiente_pago") return (c.retieneHasta ?? 0) > ahora;
  return true;
}
