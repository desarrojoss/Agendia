// Validación de todo lo que el dueño configura. Lógica pura (no importa Firebase): se prueba con node --test.
// Cada función devuelve { valor } con los datos limpios o { error } con un mensaje listo para mostrar.
import { DIAS, esFecha, esHora, hhmmAMin, zonaAUtc } from "./tiempo.ts";
import type { Anticipo, Bloqueo, Horario, Personal, Reglas, Sede, Servicio, Tramo } from "./types.ts";

export type V<T> = { valor: T } | { error: string };
const err = (error: string) => ({ error });
const texto = (x: unknown) => String(x ?? "").trim().replace(/\s+/g, " ");
const entero = (x: unknown) => (typeof x === "number" ? x : Number(String(x ?? "").replace(/[^\d-]/g, "")));
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Teléfono → solo dígitos con indicativo. Un celular colombiano de 10 dígitos (3XXXXXXXXX) recibe el 57. Vacío es válido. */
export function normalizarWhatsapp(x: unknown): V<string> {
  const d = String(x ?? "").replace(/\D/g, "");
  if (!d) return { valor: "" };
  if (d.length === 10 && d.startsWith("3")) return { valor: `57${d}` };
  if (d.length >= 11 && d.length <= 15) return { valor: d };
  return err("El WhatsApp no parece válido. Escríbelo con indicativo, por ejemplo 573001234567.");
}

/** La foto/logo debe venir de nuestra carpeta de Cloudinary del negocio (no se acepta una URL cualquiera). */
function urlPropia(url: unknown, valida: (u: string) => boolean): V<string | null> {
  const u = String(url ?? "").trim();
  if (!u) return { valor: null };
  return valida(u) && !/\s/.test(u) ? { valor: u } : err("La imagen no es válida. Súbela de nuevo.");
}

// ---------- Sede ----------
export function validarSede(e: Partial<Sede>): V<Omit<Sede, "orden">> {
  const nombre = texto(e.nombre);
  if (nombre.length < 2 || nombre.length > 60) return err("El nombre de la sede debe tener entre 2 y 60 caracteres.");
  const direccion = texto(e.direccion);
  if (direccion.length > 120) return err("La dirección es demasiado larga (máximo 120 caracteres).");
  const w = normalizarWhatsapp(e.whatsapp);
  if ("error" in w) return w;
  return { valor: { nombre, direccion, whatsapp: w.valor, activo: e.activo !== false } };
}

// ---------- Servicio ----------
export function validarAnticipo(a: unknown, precio: number): V<Anticipo> {
  const x = (a ?? {}) as { tipo?: string; valor?: unknown };
  if (!x.tipo || x.tipo === "ninguno") return { valor: { tipo: "ninguno" } };
  const valor = entero(x.valor);
  if (!Number.isInteger(valor) || valor <= 0) return err("Escribe un valor para el anticipo.");
  if (x.tipo === "porcentaje") return valor > 100 ? err("El anticipo no puede pasar del 100%.") : { valor: { tipo: "porcentaje", valor } };
  if (x.tipo === "monto") {
    if (valor > precio) return err("El anticipo no puede ser mayor que el precio del servicio.");
    return { valor: { tipo: "monto", valor } };
  }
  return err("El tipo de anticipo no es válido.");
}

export function validarServicio(e: Partial<Servicio>, sedesValidas: string[]): V<Omit<Servicio, "orden">> {
  const nombre = texto(e.nombre);
  if (nombre.length < 2 || nombre.length > 60) return err("El nombre del servicio debe tener entre 2 y 60 caracteres.");
  const descripcion = texto(e.descripcion);
  if (descripcion.length > 200) return err("La descripción es demasiado larga (máximo 200 caracteres).");
  const duracionMin = entero(e.duracionMin);
  if (!Number.isInteger(duracionMin) || duracionMin < 5 || duracionMin > 480 || duracionMin % 5 !== 0)
    return err("La duración debe ir de 5 a 480 minutos, de 5 en 5.");
  const precio = entero(e.precio);
  if (!Number.isInteger(precio) || precio < 0 || precio > 100_000_000) return err("El precio no es válido.");
  const anticipo = validarAnticipo(e.anticipo, precio);
  if ("error" in anticipo) return anticipo;
  if (anticipo.valor.tipo !== "ninguno" && precio === 0) return err("Un servicio sin precio no puede pedir anticipo.");
  const sedes = [...new Set((e.sedes ?? []).map(String))];
  if (!sedes.length) return err("Elige al menos una sede donde se ofrece.");
  if (sedes.some((s) => !sedesValidas.includes(s))) return err("Una de las sedes ya no existe.");
  return { valor: { nombre, descripcion, duracionMin, precio, anticipo: anticipo.valor, sedes, activo: e.activo !== false } };
}

// ---------- Horario ----------
export const horarioVacio = (): Horario => ({ lun: [], mar: [], mie: [], jue: [], vie: [], sab: [], dom: [] });

/** Lunes a viernes 9-13 y 14-18, sábado 9-13. */
export function horarioPorDefecto(): Horario {
  const h = horarioVacio();
  for (const d of ["lun", "mar", "mie", "jue", "vie"] as const) h[d] = [["09:00", "13:00"], ["14:00", "18:00"]];
  h.sab = [["09:00", "13:00"]];
  return h;
}

export function validarHorario(x: unknown): V<Horario> {
  const h = horarioVacio();
  const entrada = (x ?? {}) as Record<string, unknown>;
  for (const d of DIAS) {
    const tramos = Array.isArray(entrada[d]) ? (entrada[d] as unknown[]) : [];
    if (tramos.length > 4) return err("Máximo 4 tramos por día.");
    const lista: Tramo[] = [];
    for (const t of tramos) {
      const [ini, fin] = Array.isArray(t) ? t : [];
      if (!esHora(ini) || !esHora(fin)) return err("Hay una hora con formato inválido. Usa el selector de hora.");
      if (hhmmAMin(ini) >= hhmmAMin(fin)) return err("En cada tramo la hora de inicio debe ser antes que la de fin.");
      lista.push([ini, fin]);
    }
    lista.sort((a, b) => hhmmAMin(a[0]) - hhmmAMin(b[0]));
    for (let i = 1; i < lista.length; i++)
      if (hhmmAMin(lista[i][0]) < hhmmAMin(lista[i - 1][1])) return err("Hay tramos que se cruzan en el mismo día.");
    h[d] = lista;
  }
  return { valor: h };
}

// ---------- Personal ----------
export function validarPersonal(
  e: Partial<Personal>,
  ctx: { sedes: string[]; servicios: string[]; imagenValida: (u: string) => boolean },
): V<Omit<Personal, "uid" | "icsToken">> {
  const nombre = texto(e.nombre);
  if (nombre.length < 2 || nombre.length > 60) return err("El nombre debe tener entre 2 y 60 caracteres.");
  if (!e.sedeId || !ctx.sedes.includes(e.sedeId)) return err("Elige la sede donde trabaja.");
  const servicios = [...new Set((e.servicios ?? []).map(String))];
  if (!servicios.length) return err("Elige al menos un servicio que atienda.");
  if (servicios.some((s) => !ctx.servicios.includes(s))) return err("Uno de los servicios ya no existe.");
  const email = texto(e.email).toLowerCase();
  if (email && !REGEX_CORREO.test(email)) return err("El correo no parece válido.");
  const foto = urlPropia(e.fotoUrl, ctx.imagenValida);
  if ("error" in foto) return foto;
  const horario = validarHorario(e.horario);
  if ("error" in horario) return horario;
  if (e.activo !== false && DIAS.every((d) => !horario.valor[d].length)) return err("Agrega al menos un horario de trabajo.");
  return { valor: { nombre, fotoUrl: foto.valor, email, sedeId: e.sedeId, servicios, horario: horario.valor, activo: e.activo !== false } };
}

// ---------- Negocio y reglas ----------
export function validarReglas(r: Partial<Reglas>): V<Reglas> {
  const n = (x: unknown) => entero(x);
  const dentro = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;
  const anticipacionMin = n(r.anticipacionMin);
  const ventanaDias = n(r.ventanaDias);
  const limiteCancelarMin = n(r.limiteCancelarMin);
  const intervaloMin = n(r.intervaloMin);
  const margenMin = n(r.margenMin);
  if (!dentro(anticipacionMin, 0, 10080)) return err("La anticipación mínima debe ir de 0 a 10080 minutos (7 días).");
  if (!dentro(ventanaDias, 1, 365)) return err("Los días de reserva hacia adelante deben ir de 1 a 365.");
  if (!dentro(limiteCancelarMin, 0, 10080)) return err("El límite para cancelar debe ir de 0 a 10080 minutos (7 días).");
  if (intervaloMin !== 15 && intervaloMin !== 30) return err("El intervalo entre horas debe ser de 15 o 30 minutos.");
  if (!dentro(margenMin, 0, 120) || margenMin % 5 !== 0) return err("El margen entre citas debe ir de 0 a 120 minutos, de 5 en 5.");
  return { valor: { anticipacionMin, ventanaDias, limiteCancelarMin, intervaloMin, margenMin } };
}

export function validarNegocio(
  e: { nombre?: unknown; whatsapp?: unknown; direccion?: unknown; logoUrl?: unknown; reglas?: Partial<Reglas> },
  imagenValida: (u: string) => boolean,
): V<{ nombre: string; whatsapp: string; direccion: string; logoUrl: string | null; reglas: Reglas }> {
  const nombre = texto(e.nombre);
  if (nombre.length < 2 || nombre.length > 60) return err("El nombre del negocio debe tener entre 2 y 60 caracteres.");
  const w = normalizarWhatsapp(e.whatsapp);
  if ("error" in w) return w;
  const direccion = texto(e.direccion);
  if (direccion.length > 120) return err("La dirección es demasiado larga (máximo 120 caracteres).");
  const logo = urlPropia(e.logoUrl, imagenValida);
  if ("error" in logo) return logo;
  const reglas = validarReglas(e.reglas ?? {});
  if ("error" in reglas) return reglas;
  return { valor: { nombre, whatsapp: w.valor, direccion, logoUrl: logo.valor, reglas: reglas.valor } };
}

// ---------- Bloqueos ----------
export type EntradaBloqueo = {
  alcance: "negocio" | "sede" | "personal";
  sedeId?: string;
  staffId?: string;
  desdeFecha: string;
  desdeHora: string;
  hastaFecha: string;
  hastaHora: string;
  motivo?: string;
};

export function validarBloqueo(e: EntradaBloqueo, ctx: { sedes: string[]; personal: string[]; zona: string }): V<Bloqueo> {
  if (![e.desdeFecha, e.hastaFecha].every(esFecha) || ![e.desdeHora, e.hastaHora].every(esHora)) return err("Revisa las fechas y horas del bloqueo.");
  const inicio = zonaAUtc(e.desdeFecha, e.desdeHora, ctx.zona);
  const fin = zonaAUtc(e.hastaFecha, e.hastaHora, ctx.zona);
  if (fin <= inicio) return err("El bloqueo debe terminar después de empezar.");
  if (fin - inicio > 366 * 24 * 3600_000) return err("Un bloqueo no puede durar más de un año.");
  const motivo = texto(e.motivo);
  if (motivo.length > 80) return err("El motivo es demasiado largo (máximo 80 caracteres).");
  let staffId: string | null = null;
  let sedeId: string | null = null;
  if (e.alcance === "personal") {
    if (!e.staffId || !ctx.personal.includes(e.staffId)) return err("Elige a quién aplica el bloqueo.");
    staffId = e.staffId;
  } else if (e.alcance === "sede") {
    if (!e.sedeId || !ctx.sedes.includes(e.sedeId)) return err("Elige la sede a la que aplica el bloqueo.");
    sedeId = e.sedeId;
  } else if (e.alcance !== "negocio") return err("El alcance del bloqueo no es válido.");
  return { valor: { staffId, sedeId, inicio, fin, motivo } };
}

// ---------- Reserva pública ----------
export type DatosCliente = { nombre: string; whatsapp: string; email: string };

/** Datos que deja el cliente al reservar: nombre y WhatsApp obligatorios, correo opcional. */
export function validarCliente(e: { nombre?: unknown; whatsapp?: unknown; email?: unknown }): V<DatosCliente> {
  const nombre = texto(e.nombre);
  if (nombre.length < 2 || nombre.length > 60) return err("Escribe tu nombre (2 a 60 caracteres).");
  const w = normalizarWhatsapp(e.whatsapp);
  if ("error" in w) return err("Revisa tu WhatsApp: escríbelo con 10 dígitos, por ejemplo 300 123 4567.");
  if (!w.valor) return err("Escribe tu WhatsApp para poder avisarte de tu cita.");
  const email = texto(e.email).toLowerCase();
  if (email && !REGEX_CORREO.test(email)) return err("El correo no parece válido.");
  return { valor: { nombre, whatsapp: w.valor, email } };
}
