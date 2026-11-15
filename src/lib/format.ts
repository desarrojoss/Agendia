/** 25000 → "$25.000" (pesos colombianos, sin decimales). */
export const cop = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

/** 90 → "1 h 30 min" */
export function duracion(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

/** Texto corto del anticipo de un servicio. */
export function textoAnticipo(a: { tipo: string; valor?: number }, precio: number): string {
  if (a.tipo === "porcentaje") return `Anticipo ${a.valor}% (${cop(Math.round(((a.valor ?? 0) * precio) / 100))})`;
  if (a.tipo === "monto") return `Anticipo ${cop(a.valor ?? 0)}`;
  return "Sin anticipo";
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** 1763319600000 → "Lunes, 16 de noviembre, 10:00 a. m." (en la zona del negocio) */
export function fechaHoraLarga(ts: number, zona: string): string {
  return mayuscula(
    new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: zona }).format(new Date(ts)),
  );
}

/** "2026-11-16" → "Lunes 16 de noviembre" */
export function fechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return mayuscula(new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d))));
}

/** "14:30" → "2:30 p. m." */
export function horaAmpm(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}
