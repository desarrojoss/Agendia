// Candados de una reserva. Lógica pura, probada con node --test.
//
// Para que dos clientes NUNCA se queden con la misma hora, cada reserva crea un documento "candado" por cada tramo de
// 5 minutos que ocupa, dentro de una transacción. Firestore no deja crear dos veces el mismo documento: el segundo
// cliente choca y se le pide otra hora. Los candados cubren la cita completa MÁS el margen entre citas, que es la misma
// regla que usa el motor de disponibilidad (así los dos coinciden: lo que el motor ofrece, el candado lo permite).

import type { EstadoCita } from "./types.ts";

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

/**
 * Qué puede hacer el cliente con su cita desde su enlace. Cancelar o cambiar la hora solo se permite hasta el límite
 * del negocio (por defecto 4 h antes). Una cita con anticipo sin pagar se puede cancelar mientras no haya empezado.
 * Cambiar la hora solo aplica a citas confirmadas.
 */
export function gestionDeCita(c: { estado: EstadoCita; inicio: number }, limiteMin: number, ahora: number): { cancelar: boolean; reprogramar: boolean } {
  const aTiempo = c.inicio - ahora >= limiteMin * 60_000;
  return {
    cancelar: c.estado === "pendiente_pago" ? c.inicio > ahora : c.estado === "confirmada" && aTiempo,
    reprogramar: c.estado === "confirmada" && aTiempo,
  };
}

/** Enlace directo para reservar un hueco que se liberó (lo recibe quien estaba en la lista de espera). */
export const enlaceHueco = (slug: string, h: { sedeId: string; servicioId: string; fecha: string; hora: string }) =>
  `/${slug}?sede=${h.sedeId}&servicio=${h.servicioId}&fecha=${h.fecha}&hora=${h.hora}`;
