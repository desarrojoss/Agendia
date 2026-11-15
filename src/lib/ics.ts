// Archivo .ics ("Agregar a mi calendario"): lo abren Google Calendar, el iPhone, Outlook. Lógica pura, probada.

const escapar = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fechaUtc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** El estándar pide líneas de máximo 75 bytes: las largas se parten con un espacio al inicio de la continuación. */
function plegar(linea: string): string {
  const enc = new TextEncoder();
  if (enc.encode(linea).length <= 75) return linea;
  const partes: string[] = [];
  let actual = "";
  for (const ch of linea) {
    const limite = partes.length === 0 ? 75 : 74; // la continuación gasta 1 byte en el espacio
    if (enc.encode(actual + ch).length > limite) {
      partes.push(actual);
      actual = ch;
    } else actual += ch;
  }
  partes.push(actual);
  return partes.join("\r\n ");
}

export type EventoIcs = {
  uid: string;
  inicio: number; // ms UTC
  fin: number; // ms UTC
  resumen: string;
  descripcion?: string;
  ubicacion?: string;
  url?: string;
  /** Avisar tantos minutos antes (por defecto 60). 0 = sin aviso. */
  alarmaMin?: number;
  ahora?: number;
};

export function construirIcs(e: EventoIcs): string {
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Agendia//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${fechaUtc(e.ahora ?? Date.now())}`,
    `DTSTART:${fechaUtc(e.inicio)}`,
    `DTEND:${fechaUtc(e.fin)}`,
    `SUMMARY:${escapar(e.resumen)}`,
    ...(e.descripcion ? [`DESCRIPTION:${escapar(e.descripcion)}`] : []),
    ...(e.ubicacion ? [`LOCATION:${escapar(e.ubicacion)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    "STATUS:CONFIRMED",
    ...((e.alarmaMin ?? 60) > 0
      ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapar(e.resumen)}`, `TRIGGER:-PT${e.alarmaMin ?? 60}M`, "END:VALARM"]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lineas.map(plegar).join("\r\n") + "\r\n";
}
