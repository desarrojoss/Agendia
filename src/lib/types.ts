export type Rol = "dueno" | "profesional";

/** members/{uid}: a qué negocio pertenece cada usuario y con qué rol. Es la ÚNICA fuente de verdad del bizId. */
export type Miembro = { bizId: string; rol: Rol; staffId?: string | null };

export type Reglas = {
  anticipacionMin: number; // minutos mínimos entre "ahora" y la cita
  ventanaDias: number; // hasta cuántos días adelante se puede reservar
  limiteCancelarMin: number; // hasta cuántos minutos antes se puede cancelar o reprogramar
  intervaloMin: number; // 15 o 30
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
