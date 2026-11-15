import assert from "node:assert/strict";
import { test } from "node:test";
import { diasDisponibles, diaDeFecha, elegirPersonal, horasLibres, hoyEnZona, ocupaTiempo, sigueLibre, type EntradaDisp, type PersonaDisp } from "./disponibilidad.ts";
import { zonaAUtc } from "./tiempo.ts";
import { horarioVacio } from "./validaciones.ts";

const ZONA = "America/Bogota";
const utc = (fecha: string, hora: string, zona = ZONA) => zonaAUtc(fecha, hora, zona);
const horas = (e: EntradaDisp) => horasLibres(e).map((h) => h.hora);

// Lunes 2026-11-16. "Ahora" es el domingo 15 a las 08:00 en Bogotá, así que nada estorba por anticipación.
const LUNES = "2026-11-16";
const AHORA = utc("2026-11-15", "08:00");
const REGLAS = { anticipacionMin: 120, ventanaDias: 30, limiteCancelarMin: 240, intervaloMin: 30, margenMin: 0 };
const horarioPartido = () => ({ ...horarioVacio(), lun: [["09:00", "13:00"], ["14:00", "18:00"]] as [string, string][] });
const luis: PersonaDisp = { id: "luis", sedeId: "s1", horario: horarioPartido() };
const ana: PersonaDisp = { id: "ana", sedeId: "s1", horario: horarioPartido() };
const base = (o: Partial<EntradaDisp> = {}): EntradaDisp => ({
  ahora: AHORA, zona: ZONA, reglas: REGLAS, duracionMin: 30, fecha: LUNES, personal: [luis], bloqueos: [], citas: [], ...o,
});

test("horario con pausa: no se ofrece nada entre los tramos", () => {
  const h = horas(base());
  assert.equal(h.length, 16);
  assert.deepEqual(h.slice(0, 2), ["09:00", "09:30"]);
  assert.equal(h.includes("12:30"), true);
  assert.equal(h.includes("13:00"), false); // pausa 13:00-14:00
  assert.equal(h.includes("13:30"), false);
  assert.equal(h[8], "14:00");
  assert.equal(h.at(-1), "17:30");
});

test("la cita completa debe caber en el tramo (servicio de 60 min)", () => {
  const h = horas(base({ duracionMin: 60 }));
  assert.equal(h.includes("12:00"), true);
  assert.equal(h.includes("12:30"), false); // terminaría a las 13:30, dentro de la pausa
  assert.equal(h.at(-1), "17:00");
  const largo = horas(base({ duracionMin: 120 }));
  assert.deepEqual(largo.filter((x) => x < "13:00"), ["09:00", "09:30", "10:00", "10:30", "11:00"]);
});

test("el intervalo de 15 minutos ofrece más horas", () => {
  assert.equal(horas(base({ reglas: { ...REGLAS, intervaloMin: 15 } })).length, 30); // 15 + 15: de 09:00 a 12:30 y de 14:00 a 17:30, cada 15 min
});

test("las horas se cuentan desde el inicio del tramo", () => {
  const p = { ...luis, horario: { ...horarioVacio(), lun: [["09:15", "11:15"]] as [string, string][] } };
  assert.deepEqual(horas(base({ personal: [p] })), ["09:15", "09:45", "10:15", "10:45"]);
});

test("una cita ocupa su espacio y deja libre lo de al lado", () => {
  const cita = { staffId: "luis", inicio: utc(LUNES, "10:00"), fin: utc(LUNES, "11:00") };
  const h = horas(base({ citas: [cita] }));
  assert.equal(h.includes("09:30"), true); // termina justo a las 10:00
  assert.equal(h.includes("10:00"), false);
  assert.equal(h.includes("10:30"), false);
  assert.equal(h.includes("11:00"), true);
  // un servicio de 60 min que arrancaría 09:30 chocaría con la cita
  assert.equal(horas(base({ citas: [cita], duracionMin: 60 })).includes("09:30"), false);
  assert.equal(horas(base({ citas: [cita], duracionMin: 60 })).includes("09:00"), true);
});

test("margen entre citas", () => {
  const cita = { staffId: "luis", inicio: utc(LUNES, "10:00"), fin: utc(LUNES, "10:30") };
  const h = horas(base({ citas: [cita], reglas: { ...REGLAS, margenMin: 15 } }));
  assert.equal(h.includes("09:30"), false); // terminaría 10:00, sin los 15 min de margen
  assert.equal(h.includes("09:00"), true);
  assert.equal(h.includes("10:30"), false); // empezaría 10:30, sin margen tras la cita
  assert.equal(h.includes("11:00"), true);
});

test("la cita de otra persona no estorba", () => {
  const cita = { staffId: "ana", inicio: utc(LUNES, "10:00"), fin: utc(LUNES, "11:00") };
  assert.equal(horas(base({ citas: [cita] })).includes("10:00"), true);
});

test("bloqueos: por persona, por sede y de todo el negocio", () => {
  const rango = { inicio: utc(LUNES, "10:00"), fin: utc(LUNES, "12:00"), motivo: "" };
  const deLuis = { ...rango, staffId: "luis", sedeId: null };
  const deSede = { ...rango, staffId: null, sedeId: "s1" };
  const deOtraSede = { ...rango, staffId: null, sedeId: "s2" };
  const detodos = { ...rango, staffId: null, sedeId: null };
  const sinBloqueo = (b: typeof rango & { staffId: string | null; sedeId: string | null }, id = "luis") => {
    const p = { ...luis, id };
    return horas(base({ personal: [p], bloqueos: [b] })).includes("10:00");
  };
  assert.equal(sinBloqueo(deLuis), false);
  assert.equal(sinBloqueo(deLuis, "ana"), true); // el bloqueo era de Luis, no de Ana
  assert.equal(sinBloqueo(deSede), false);
  assert.equal(sinBloqueo(deOtraSede), true);
  assert.equal(sinBloqueo(detodos), false);
  // terminar justo cuando empieza el bloqueo, o empezar justo cuando acaba, sí se puede
  const h = horas(base({ bloqueos: [detodos] }));
  assert.equal(h.includes("09:30"), true);
  assert.equal(h.includes("12:00"), true);
});

test("un bloqueo de varios días cubre los días del medio", () => {
  const bloqueo = { staffId: null, sedeId: null, inicio: utc("2026-12-24", "00:00"), fin: utc("2026-12-26", "00:00"), motivo: "Navidad" };
  const ahora = utc("2026-12-01", "08:00");
  assert.equal(horas(base({ fecha: "2026-12-24", ahora, bloqueos: [bloqueo] })).length, 0); // jueves
  assert.equal(horas(base({ fecha: "2026-12-25", ahora, bloqueos: [bloqueo] })).length, 0); // viernes
  assert.equal(horas(base({ fecha: "2026-12-28", ahora, bloqueos: [bloqueo] })).length > 0, true); // lunes
});

test("anticipación mínima", () => {
  // Es lunes 10:10 en Bogotá y se exigen 2 horas: la primera hora posible es 12:30 (12:10 no es una hora ofrecida)
  const ahora = utc(LUNES, "10:10");
  const h = horas(base({ ahora }));
  assert.equal(h[0], "12:30");
  assert.equal(h.includes("12:00"), false);
  // sin anticipación se puede reservar lo que falta del día
  assert.equal(horas(base({ ahora, reglas: { ...REGLAS, anticipacionMin: 0 } }))[0], "10:30");
});

test("ventana de reserva y días pasados", () => {
  const hoy = hoyEnZona(AHORA, ZONA); // 2026-11-15
  assert.equal(hoy, "2026-11-15");
  assert.equal(horas(base({ fecha: "2026-11-14" })).length, 0); // ayer
  assert.equal(horas(base({ fecha: "2026-12-14", reglas: { ...REGLAS, ventanaDias: 30 } })).length > 0, true); // hoy + 29 días (lunes)
  assert.equal(horas(base({ fecha: "2026-12-21", reglas: { ...REGLAS, ventanaDias: 30 } })).length, 0); // hoy + 36
  assert.equal(horas(base({ fecha: "2026-11-23", reglas: { ...REGLAS, ventanaDias: 7 } })).length, 0); // hoy + 8
  assert.equal(horas(base({ fecha: "2026-11-22", reglas: { ...REGLAS, ventanaDias: 7 } })).length, 0); // domingo sin horario
});

test("un día sin horario no ofrece nada", () => {
  assert.equal(horas(base({ fecha: "2026-11-17" })).length, 0); // martes: el horario solo tiene lunes
  assert.equal(diaDeFecha("2026-11-22"), "dom");
});

test("zona horaria: 'hoy' se mira en Bogotá, no en UTC", () => {
  // 2026-11-17 03:00 UTC = lunes 16 a las 22:00 en Bogotá: todavía es lunes
  const ahora = Date.UTC(2026, 10, 17, 3, 0);
  assert.equal(hoyEnZona(ahora, ZONA), "2026-11-16");
  assert.equal(horas(base({ ahora, fecha: LUNES })).length, 0); // ya no queda nada de hoy (anticipación de 2 h)
  assert.equal(horas(base({ ahora, fecha: "2026-11-15" })).length, 0); // ayer
  // y las horas devueltas se guardan en UTC: las 09:00 de Bogotá son las 14:00 UTC
  assert.equal(horasLibres(base())[0].inicio, Date.UTC(2026, 10, 16, 14, 0));
});

test("varios profesionales: se ve la unión y quién está libre en cada hora", () => {
  const cita = { staffId: "luis", inicio: utc(LUNES, "10:00"), fin: utc(LUNES, "10:30") };
  const hs = horasLibres(base({ personal: [luis, ana], citas: [cita] }));
  const a = hs.find((h) => h.hora === "10:00")!;
  assert.deepEqual(a.staffIds, ["ana"]); // Luis está ocupado
  assert.deepEqual(hs.find((h) => h.hora === "09:30")!.staffIds, ["luis", "ana"]);
  // si los dos están ocupados, esa hora desaparece
  const cita2 = { ...cita, staffId: "ana" };
  assert.equal(horas(base({ personal: [luis, ana], citas: [cita, cita2] })).includes("10:00"), false);
});

test("'cualquiera' reparte la carga: se elige al que tiene menos citas ese día", () => {
  const c = (staffId: string, hora: string) => ({ staffId, inicio: utc(LUNES, hora), fin: utc(LUNES, hora) + 1800_000 });
  assert.equal(elegirPersonal(["luis", "ana"], [c("luis", "09:00"), c("luis", "10:00"), c("ana", "09:00")], LUNES, ZONA), "ana");
  assert.equal(elegirPersonal(["luis", "ana"], [], LUNES, ZONA), "luis"); // empate: el primero
  // las citas de otro día no cuentan
  const otroDia = { staffId: "luis", inicio: utc("2026-11-17", "09:00"), fin: utc("2026-11-17", "09:30") };
  assert.equal(elegirPersonal(["ana", "luis"], [otroDia], LUNES, ZONA), "ana");
});

test("al reprogramar, la propia cita no se estorba a sí misma", () => {
  const cita = { id: "c1", staffId: "luis", inicio: utc(LUNES, "10:00"), fin: utc(LUNES, "10:30") };
  assert.equal(horas(base({ citas: [cita] })).includes("10:00"), false);
  assert.equal(horas(base({ citas: [cita], ignorarCitaId: "c1" })).includes("10:00"), true);
});

test("sigueLibre revalida una hora puntual", () => {
  const e = base({ personal: [luis, ana] });
  assert.equal(sigueLibre(e, utc(LUNES, "09:00"), "luis"), true);
  const ocupada = { ...e, citas: [{ staffId: "luis", inicio: utc(LUNES, "09:00"), fin: utc(LUNES, "09:30") }] };
  assert.equal(sigueLibre(ocupada, utc(LUNES, "09:00"), "luis"), false);
  assert.equal(sigueLibre(ocupada, utc(LUNES, "09:00"), "ana"), true);
  assert.equal(sigueLibre(e, utc(LUNES, "13:00"), "luis"), false); // pausa
});

test("diasDisponibles pinta solo los días con cupo", () => {
  const { fecha: _f, ...sinFecha } = base();
  void _f;
  const dias = diasDisponibles(sinFecha, "2026-11-15", 8); // dom 15 ... dom 22: solo el lunes 16 trabaja
  assert.deepEqual(dias, ["2026-11-16"]);
  const conOtro = diasDisponibles({ ...sinFecha, personal: [{ ...luis, horario: { ...horarioPartido(), mie: [["09:00", "10:00"]] } }] }, "2026-11-15", 8);
  assert.deepEqual(conOtro, ["2026-11-16", "2026-11-18"]);
});

test("horario de verano: el mismo horario local cae en otra hora UTC", () => {
  const ny = (fecha: string, ahora: number) => base({ zona: "America/New_York", fecha, ahora, personal: [{ ...luis, horario: { ...horarioVacio(), sab: [["09:00", "10:00"]], dom: [["09:00", "10:00"]] } }] });
  const antes = horasLibres(ny("2026-03-07", Date.UTC(2026, 2, 1))); // sábado, invierno (UTC-5)
  const despues = horasLibres(ny("2026-03-08", Date.UTC(2026, 2, 1))); // domingo, ya con horario de verano (UTC-4)
  assert.equal(antes[0].inicio, Date.UTC(2026, 2, 7, 14, 0));
  assert.equal(despues[0].inicio, Date.UTC(2026, 2, 8, 13, 0));
});

test("qué citas ocupan tiempo: las canceladas no, y el pago pendiente solo mientras dura la retención", () => {
  const ahora = 1_000_000;
  assert.equal(ocupaTiempo({ estado: "confirmada" }, ahora), true);
  assert.equal(ocupaTiempo({ estado: "atendida" }, ahora), true);
  assert.equal(ocupaTiempo({ estado: "no_llego" }, ahora), true);
  assert.equal(ocupaTiempo({ estado: "cancelada" }, ahora), false);
  assert.equal(ocupaTiempo({ estado: "pendiente_pago", retieneHasta: ahora + 1 }, ahora), true);
  assert.equal(ocupaTiempo({ estado: "pendiente_pago", retieneHasta: ahora }, ahora), false); // venció
  assert.equal(ocupaTiempo({ estado: "pendiente_pago" }, ahora), false);
});
