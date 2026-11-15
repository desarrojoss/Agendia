import assert from "node:assert/strict";
import { test } from "node:test";
import { horarioPorDefecto, horarioVacio, normalizarWhatsapp, validarAnticipo, validarBloqueo, validarHorario, validarNegocio, validarPersonal, validarReglas, validarSede, validarServicio } from "./validaciones.ts";

const ok = (r: unknown): r is { valor: never } => !!r && typeof r === "object" && "valor" in r;
const mensaje = (r: unknown) => (r as { error: string }).error;

test("WhatsApp: celular colombiano recibe el 57", () => {
  assert.deepEqual(normalizarWhatsapp("300 123 4567"), { valor: "573001234567" });
  assert.deepEqual(normalizarWhatsapp("+57 300 123 4567"), { valor: "573001234567" });
  assert.deepEqual(normalizarWhatsapp(""), { valor: "" });
  assert.equal(ok(normalizarWhatsapp("123")), false);
});

test("sede", () => {
  assert.equal(ok(validarSede({ nombre: "Centro", direccion: "Cra 1 # 2-3" })), true);
  assert.equal(ok(validarSede({ nombre: "C" })), false);
});

test("anticipo: porcentaje hasta 100 y monto hasta el precio", () => {
  assert.deepEqual(validarAnticipo({ tipo: "porcentaje", valor: 30 }, 50000), { valor: { tipo: "porcentaje", valor: 30 } });
  assert.equal(ok(validarAnticipo({ tipo: "porcentaje", valor: 101 }, 50000)), false);
  assert.equal(ok(validarAnticipo({ tipo: "monto", valor: 60000 }, 50000)), false);
  assert.deepEqual(validarAnticipo({ tipo: "ninguno" }, 0), { valor: { tipo: "ninguno" } });
  assert.equal(ok(validarAnticipo({ tipo: "monto", valor: 0 }, 50000)), false);
});

test("servicio: duración de 5 en 5, sedes obligatorias y existentes, sin anticipo si es gratis", () => {
  const base = { nombre: "Corte", duracionMin: 30, precio: 25000, sedes: ["s1"], anticipo: { tipo: "ninguno" as const } };
  assert.equal(ok(validarServicio(base, ["s1"])), true);
  assert.equal(ok(validarServicio({ ...base, duracionMin: 32 }, ["s1"])), false);
  assert.equal(ok(validarServicio({ ...base, sedes: [] }, ["s1"])), false);
  assert.equal(ok(validarServicio({ ...base, sedes: ["otra"] }, ["s1"])), false);
  assert.equal(ok(validarServicio({ ...base, precio: 0, anticipo: { tipo: "porcentaje", valor: 20 } }, ["s1"])), false);
  const r = validarServicio({ ...base, precio: "25.000" as unknown as number }, ["s1"]);
  assert.equal(ok(r) && (r as { valor: { precio: number } }).valor.precio, 25000);
});

test("horario: tramos ordenados, sin cruces y con pausas", () => {
  assert.equal(ok(validarHorario(horarioPorDefecto())), true);
  const malo = { ...horarioVacio(), lun: [["10:00", "09:00"]] };
  assert.equal(ok(validarHorario(malo)), false);
  const cruce = { ...horarioVacio(), lun: [["09:00", "12:00"], ["11:00", "14:00"]] };
  assert.equal(mensaje(validarHorario(cruce)), "Hay tramos que se cruzan en el mismo día.");
  const desordenado = { ...horarioVacio(), lun: [["14:00", "18:00"], ["09:00", "13:00"]] };
  const r = validarHorario(desordenado) as { valor: { lun: string[][] } };
  assert.deepEqual(r.valor.lun[0], ["09:00", "13:00"]);
  assert.equal(ok(validarHorario({ ...horarioVacio(), lun: [["9:00", "13:00"]] })), false);
});

test("personal: sede y servicios existentes, foto solo de nuestra carpeta, horario no vacío", () => {
  const prefijo = "https://res.cloudinary.com/x/image/upload/v1/agendia/biz1/";
  const ctx = { sedes: ["s1"], servicios: ["a", "b"], imagenValida: (u: string) => u.startsWith(prefijo) };
  const base = { nombre: "Luis", sedeId: "s1", servicios: ["a"], horario: horarioPorDefecto() };
  assert.equal(ok(validarPersonal(base, ctx)), true);
  assert.equal(ok(validarPersonal({ ...base, sedeId: "x" }, ctx)), false);
  assert.equal(ok(validarPersonal({ ...base, servicios: ["z"] }, ctx)), false);
  assert.equal(ok(validarPersonal({ ...base, fotoUrl: "https://evil.com/a.png" }, ctx)), false);
  assert.equal(ok(validarPersonal({ ...base, fotoUrl: `${prefijo}personal/a.png` }, ctx)), true);
  assert.equal(ok(validarPersonal({ ...base, horario: horarioVacio() }, ctx)), false);
  assert.equal(ok(validarPersonal({ ...base, horario: horarioVacio(), activo: false }, ctx)), true);
  assert.equal(ok(validarPersonal({ ...base, email: "no-es-correo" }, ctx)), false);
});

test("reglas del negocio", () => {
  const base = { anticipacionMin: 120, ventanaDias: 30, limiteCancelarMin: 240, intervaloMin: 30, margenMin: 0 };
  assert.equal(ok(validarReglas(base)), true);
  assert.equal(ok(validarReglas({ ...base, intervaloMin: 20 })), false);
  assert.equal(ok(validarReglas({ ...base, ventanaDias: 0 })), false);
  assert.equal(ok(validarReglas({ ...base, margenMin: 7 })), false);
  assert.equal(ok(validarNegocio({ nombre: "Mi negocio", whatsapp: "3001234567", reglas: base }, () => true)), true);
  assert.equal(ok(validarNegocio({ nombre: "M", reglas: base }, () => true)), false);
});

test("bloqueo: se guarda en UTC con la hora de Bogotá y respeta el alcance", () => {
  const ctx = { sedes: ["s1"], personal: ["p1"], zona: "America/Bogota" };
  const base = { alcance: "negocio" as const, desdeFecha: "2026-12-24", desdeHora: "00:00", hastaFecha: "2026-12-26", hastaHora: "00:00", motivo: "Navidad" };
  const r = validarBloqueo(base, ctx) as { valor: { inicio: number; fin: number; staffId: null } };
  assert.equal(r.valor.inicio, Date.UTC(2026, 11, 24, 5, 0));
  assert.equal(r.valor.staffId, null);
  assert.equal(ok(validarBloqueo({ ...base, hastaFecha: "2026-12-23" }, ctx)), false);
  assert.equal(ok(validarBloqueo({ ...base, alcance: "personal" }, ctx)), false);
  assert.equal(ok(validarBloqueo({ ...base, alcance: "personal", staffId: "p1" }, ctx)), true);
  assert.equal(ok(validarBloqueo({ ...base, alcance: "sede", sedeId: "nope" }, ctx)), false);
});
