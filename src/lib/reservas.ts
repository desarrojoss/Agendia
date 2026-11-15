// Candados de una reserva. Lógica pura, probada con node --test.
//
// Para que dos clientes NUNCA se queden con la misma hora, cada reserva crea un documento "candado" por cada tramo de
// 5 minutos que ocupa, dentro de una transacción. Firestore no deja crear dos veces el mismo documento: el segundo
// cliente choca y se le pide otra hora. Los candados cubren la cita completa MÁS el margen entre citas, que es la misma
// regla que usa el motor de disponibilidad (así los dos coinciden: lo que el motor ofrece, el candado lo permite).

export const PASO_CANDADO_MS = 5 * 60_000;

/** Ids de los candados de una cita: `<staffId>_<tramo de 5 min desde 1970>`. */
export function clavesDeCandado(staffId: string, inicio: number, fin: number, margenMin: number): string[] {
  const hasta = fin + margenMin * 60_000;
  const claves: string[] = [];
  for (let t = Math.floor(inicio / PASO_CANDADO_MS); t * PASO_CANDADO_MS < hasta; t++) claves.push(`${staffId}_${t}`);
  return claves;
}

/** Minutos que se retiene la hora mientras el cliente paga el anticipo. */
export const MINUTOS_RETENCION = 15;

/** Cuánto hay que pagar para reservar (COP). 0 = no pide anticipo. Nunca más que el precio. */
export function anticipoDe(s: { precio: number; anticipo: { tipo: string; valor?: number } }): number {
  if (s.anticipo.tipo === "porcentaje") return Math.min(s.precio, Math.round((s.precio * (s.anticipo.valor ?? 0)) / 100));
  if (s.anticipo.tipo === "monto") return Math.min(s.precio, s.anticipo.valor ?? 0);
  return 0;
}
