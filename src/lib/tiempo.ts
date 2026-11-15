// Fechas y horas en la zona del negocio. Se guarda SIEMPRE en UTC (ms) y se muestra en la zona del negocio.
// Lógica pura con Intl nativo (sin librerías de fechas), probada con node --test.

export const DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as const;
export type Dia = (typeof DIAS)[number];
export const NOMBRE_DIA: Record<Dia, string> = { lun: "Lunes", mar: "Martes", mie: "Miércoles", jue: "Jueves", vie: "Viernes", sab: "Sábado", dom: "Domingo" };

const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export const esHora = (h: unknown): h is string => typeof h === "string" && RE_HORA.test(h);

export function esFecha(f: unknown): f is string {
  if (typeof f !== "string") return false;
  const m = RE_FECHA.exec(f);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** "09:30" → 570 */
export const hhmmAMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
/** 570 → "09:30" */
export const minAHhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Diferencia (ms) entre la hora local de la zona y UTC en ese instante: Bogotá = -5 h = -18_000_000. */
function desfase(ts: number, zona: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: zona, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ts));
  const v = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second")) - Math.floor(ts / 1000) * 1000;
}

/** Hora de pared de la zona ("2026-11-20", "15:00") → instante UTC en ms. */
export function zonaAUtc(fecha: string, hora: string, zona: string): number {
  const [y, mo, d] = fecha.split("-").map(Number);
  const [h, mi] = hora.split(":").map(Number);
  const pared = Date.UTC(y, mo - 1, d, h, mi);
  let utc = pared - desfase(pared, zona);
  utc = pared - desfase(utc, zona); // segunda pasada: acierta también cerca de un cambio de horario
  return utc;
}

/** Instante UTC → fecha, hora y día de la semana (lun=0) en la zona. */
export function utcAZona(ts: number, zona: string): { fecha: string; hora: string; dia: Dia } {
  const pared = new Date(ts + desfase(ts, zona));
  const fecha = pared.toISOString().slice(0, 10);
  const hora = pared.toISOString().slice(11, 16);
  return { fecha, hora, dia: DIAS[(pared.getUTCDay() + 6) % 7] };
}

/** Suma días a una fecha "YYYY-MM-DD" (en calendario, sin zonas). */
export function sumarDias(fecha: string, n: number): string {
  const [y, mo, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}
