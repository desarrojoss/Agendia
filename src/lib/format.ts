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
