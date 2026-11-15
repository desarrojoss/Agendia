import assert from "node:assert/strict";
import { test } from "node:test";
import { construirIcs } from "./ics.ts";
import { anticipoDe, clavesDeCandado, enlaceHueco, gestionDeCita, PASO_CANDADO_MS } from "./reservas.ts";
import { mensajeReserva, urlWhatsapp } from "./whatsapp.ts";

const MIN = 60_000;
const t0 = Date.UTC(2026, 10, 16, 15, 0); // múltiplo exacto de 5 minutos

test("candados: una cita de 30 min ocupa 6 tramos de 5 min", () => {
  const c = clavesDeCandado("luis", t0, t0 + 30 * MIN, 0);
  assert.equal(c.length, 6);
  assert.equal(new Set(c).size, 6);
  assert.ok(c.every((x) => x.startsWith("luis_")));
});

test("candados: el margen entre citas se suma al final", () => {
  assert.equal(clavesDeCandado("luis", t0, t0 + 30 * MIN, 15).length, 9);
});

test("candados: dos citas seguidas no chocan, pero con margen sí se pisan", () => {
  const a = clavesDeCandado("luis", t0, t0 + 30 * MIN, 0);
  const b = clavesDeCandado("luis", t0 + 30 * MIN, t0 + 60 * MIN, 0);
  assert.equal(a.filter((x) => b.includes(x)).length, 0); // 15:00-15:30 y 15:30-16:00: libre
  const conMargen = clavesDeCandado("luis", t0, t0 + 30 * MIN, 15);
  assert.equal(conMargen.filter((x) => b.includes(x)).length, 3); // con 15 min de margen, la siguiente no puede empezar a las 15:30
});

test("candados: distintas personas o cualquier solapamiento comparten clave solo si es la misma persona", () => {
  const a = clavesDeCandado("luis", t0, t0 + 30 * MIN, 0);
  const b = clavesDeCandado("ana", t0, t0 + 30 * MIN, 0);
  assert.equal(a.filter((x) => b.includes(x)).length, 0);
  const solapada = clavesDeCandado("luis", t0 + 15 * MIN, t0 + 45 * MIN, 0);
  assert.equal(a.filter((x) => solapada.includes(x)).length, 3);
  assert.equal(PASO_CANDADO_MS, 300_000);
});

test(".ics: formato, UTC y caracteres especiales", () => {
  const ics = construirIcs({
    uid: "cita1@agendia", inicio: Date.UTC(2026, 10, 16, 15, 0), fin: Date.UTC(2026, 10, 16, 15, 30),
    resumen: "Corte, barba; y más", descripcion: "Línea 1\nLínea 2", ubicacion: "Cra 45 # 70-20, Barranquilla", ahora: Date.UTC(2026, 10, 15, 12, 0),
  });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(ics.includes("DTSTART:20261116T150000Z\r\n"));
  assert.ok(ics.includes("DTEND:20261116T153000Z\r\n"));
  assert.ok(ics.includes("DTSTAMP:20261115T120000Z\r\n"));
  assert.ok(ics.includes("SUMMARY:Corte\\, barba\\; y más\r\n"));
  assert.ok(ics.includes("DESCRIPTION:Línea 1\\nLínea 2\r\n"));
  assert.ok(ics.includes("TRIGGER:-PT60M"));
  assert.equal(construirIcs({ uid: "x", inicio: t0, fin: t0 + MIN, resumen: "x", alarmaMin: 0 }).includes("VALARM"), false);
});

test(".ics: las líneas largas se pliegan a 75 bytes", () => {
  const ics = construirIcs({ uid: "x", inicio: t0, fin: t0 + MIN, resumen: "ñ".repeat(100) });
  const enc = new TextEncoder();
  for (const linea of ics.split("\r\n")) assert.ok(enc.encode(linea).length <= 75, linea);
  // al desplegar las continuaciones se recupera el texto completo
  assert.ok(ics.replace(/\r\n /g, "").includes(`SUMMARY:${"ñ".repeat(100)}`));
});

test("WhatsApp: enlace y mensaje", () => {
  assert.equal(urlWhatsapp("+57 300 123 4567", "Hola & adiós"), "https://wa.me/573001234567?text=Hola%20%26%20adi%C3%B3s");
  const m = mensajeReserva({ negocio: "Navaja", servicio: "Corte", cuando: "Lunes 16 de noviembre, 10:00 a. m.", profesional: "Luis", cliente: "Ana" });
  assert.ok(m.includes("Navaja") && m.includes("Corte") && m.includes("Luis") && m.includes("A nombre de: Ana"));
});

test("anticipo: porcentaje, monto fijo, ninguno y tope en el precio", () => {
  assert.equal(anticipoDe({ precio: 40000, anticipo: { tipo: "porcentaje", valor: 30 } }), 12000);
  assert.equal(anticipoDe({ precio: 40000, anticipo: { tipo: "monto", valor: 15000 } }), 15000);
  assert.equal(anticipoDe({ precio: 40000, anticipo: { tipo: "ninguno" } }), 0);
  assert.equal(anticipoDe({ precio: 10000, anticipo: { tipo: "monto", valor: 50000 } }), 10000);
  assert.equal(anticipoDe({ precio: 33333, anticipo: { tipo: "porcentaje", valor: 50 } }), 16667);
});

test("gestión: cancelar y reprogramar solo hasta el límite", () => {
  const ahora = t0;
  const lim = 240; // 4 h
  const cita = (min: number, estado: "confirmada" | "pendiente_pago" | "cancelada" | "atendida" = "confirmada") => ({ estado, inicio: ahora + min * MIN });
  assert.deepEqual(gestionDeCita(cita(300), lim, ahora), { cancelar: true, reprogramar: true });
  assert.deepEqual(gestionDeCita(cita(240), lim, ahora), { cancelar: true, reprogramar: true }); // justo en el límite sí
  assert.deepEqual(gestionDeCita(cita(239), lim, ahora), { cancelar: false, reprogramar: false });
  assert.deepEqual(gestionDeCita(cita(300, "cancelada"), lim, ahora), { cancelar: false, reprogramar: false });
  assert.deepEqual(gestionDeCita(cita(-10, "atendida"), lim, ahora), { cancelar: false, reprogramar: false });
  // con anticipo sin pagar: se puede cancelar aunque falte poco, pero no mover
  assert.deepEqual(gestionDeCita(cita(30, "pendiente_pago"), lim, ahora), { cancelar: true, reprogramar: false });
  assert.deepEqual(gestionDeCita(cita(-5, "pendiente_pago"), lim, ahora), { cancelar: false, reprogramar: false });
});

test("enlace del hueco libre lleva sede, servicio, día y hora", () => {
  assert.equal(enlaceHueco("navaja", { sedeId: "s1", servicioId: "v2", fecha: "2026-11-20", hora: "15:30" }), "/navaja?sede=s1&servicio=v2&fecha=2026-11-20&hora=15:30");
});
