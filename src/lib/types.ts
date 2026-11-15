import type { Dia } from "./tiempo.ts";

export type Rol = "dueno" | "profesional";

/** members/{uid}: a qué negocio pertenece cada usuario y con qué rol. Es la ÚNICA fuente de verdad del bizId. */
export type Miembro = { bizId: string; rol: Rol; staffId?: string | null };

export type Reglas = {
  anticipacionMin: number; // minutos mínimos entre "ahora" y la cita
  ventanaDias: number; // hasta cuántos días adelante se puede reservar
  limiteCancelarMin: number; // hasta cuántos minutos antes se puede cancelar o reprogramar
  intervaloMin: number; // 15 o 30: cada cuánto se ofrece una hora
  margenMin: number; // margen entre citas
};

export const REGLAS_POR_DEFECTO: Reglas = { anticipacionMin: 120, ventanaDias: 30, limiteCancelarMin: 240, intervaloMin: 30, margenMin: 0 };

export type Negocio = {
  nombre: string;
  slug: string;
  logoUrl: string | null;
  direccion: string;
  whatsapp: string;
  zona: string;
  reglas: Reglas;
  demo: boolean;
  suspendido: boolean;
  ownerUid: string;
};

/** businesses/{bizId}/locations/{id} */
export type Sede = { nombre: string; direccion: string; whatsapp: string; activo: boolean; orden: number };

export type Anticipo = { tipo: "ninguno" } | { tipo: "porcentaje"; valor: number } | { tipo: "monto"; valor: number };

/** businesses/{bizId}/services/{id} */
export type Servicio = {
  nombre: string;
  descripcion: string;
  duracionMin: number;
  precio: number; // COP
  anticipo: Anticipo;
  sedes: string[]; // ids de sedes donde se ofrece
  activo: boolean;
  orden: number;
};

/** Horas "HH:MM" por día; varios tramos por día = pausas (ej. 09:00-13:00 y 14:00-19:00). Día sin tramos = no trabaja. */
export type Tramo = [string, string];
export type Horario = Record<Dia, Tramo[]>;

/** businesses/{bizId}/staff/{id} */
export type Personal = {
  nombre: string;
  fotoUrl: string | null;
  email: string; // para invitarlo al panel (ejecución 7)
  uid: string | null;
  sedeId: string;
  servicios: string[]; // ids de servicios que atiende
  horario: Horario;
  activo: boolean;
  icsToken: string;
};

/** businesses/{bizId}/blocks/{id}: horas u días en los que no se atiende. */
export type Bloqueo = { staffId: string | null; sedeId: string | null; inicio: number; fin: number; motivo: string };

export type Con<T> = T & { id: string };

/** Estados de una cita. Solo "cancelada" libera la hora; "pendiente_pago" la retiene hasta `retieneHasta`. */
export type EstadoCita = "pendiente_pago" | "confirmada" | "atendida" | "no_llego" | "cancelada";
