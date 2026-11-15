// Mensajes de WhatsApp ya armados (enlaces wa.me). Lógica pura, probada.

/** wa.me exige solo dígitos con indicativo, sin "+". */
export const urlWhatsapp = (numero: string, texto: string) => `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;

/** Lo que el cliente le escribe al negocio después de reservar. */
export function mensajeReserva(d: { negocio: string; servicio: string; cuando: string; profesional: string; cliente: string }): string {
  return [
    `Hola ${d.negocio}, acabo de reservar una cita:`,
    `• Servicio: ${d.servicio}`,
    `• Cuándo: ${d.cuando}`,
    `• Con: ${d.profesional}`,
    `• A nombre de: ${d.cliente}`,
    "¡Gracias!",
  ].join("\n");
}
