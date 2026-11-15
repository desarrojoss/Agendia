import assert from "node:assert/strict";
import { test } from "node:test";
import { esFecha, esHora, hhmmAMin, minAHhmm, sumarDias, utcAZona, zonaAUtc } from "./tiempo.ts";

test("Bogotá es UTC-5 todo el año", () => {
  assert.equal(zonaAUtc("2026-11-20", "15:00", "America/Bogota"), Date.UTC(2026, 10, 20, 20, 0));
  assert.equal(zonaAUtc("2026-07-01", "00:00", "America/Bogota"), Date.UTC(2026, 6, 1, 5, 0));
  assert.deepEqual(utcAZona(Date.UTC(2026, 10, 21, 3, 30), "America/Bogota"), { fecha: "2026-11-20", hora: "22:30", dia: "vie" });
});

test("ida y vuelta zona ↔ UTC", () => {
  for (const [f, h] of [["2026-01-01", "00:00"], ["2026-12-31", "23:55"], ["2026-02-28", "12:05"]]) {
    const r = utcAZona(zonaAUtc(f, h, "America/Bogota"), "America/Bogota");
    assert.equal(`${r.fecha} ${r.hora}`, `${f} ${h}`);
  }
});

test("respeta horario de verano en zonas que lo tienen", () => {
  // Nueva York: invierno UTC-5, verano UTC-4
  assert.equal(zonaAUtc("2026-01-15", "12:00", "America/New_York"), Date.UTC(2026, 0, 15, 17, 0));
  assert.equal(zonaAUtc("2026-07-15", "12:00", "America/New_York"), Date.UTC(2026, 6, 15, 16, 0));
});

test("día de la semana (lunes = primero)", () => {
  assert.equal(utcAZona(zonaAUtc("2026-11-16", "10:00", "America/Bogota"), "America/Bogota").dia, "lun");
  assert.equal(utcAZona(zonaAUtc("2026-11-22", "10:00", "America/Bogota"), "America/Bogota").dia, "dom");
});

test("validaciones y utilidades", () => {
  assert.equal(esHora("09:30"), true);
  assert.equal(esHora("24:00"), false);
  assert.equal(esHora("9:30"), false);
  assert.equal(esFecha("2026-02-29"), false);
  assert.equal(esFecha("2026-02-28"), true);
  assert.equal(hhmmAMin("09:30"), 570);
  assert.equal(minAHhmm(570), "09:30");
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
});
