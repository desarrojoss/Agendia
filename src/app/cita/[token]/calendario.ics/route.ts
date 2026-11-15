import { citaPorToken } from "@/lib/citas-publico";
import { construirIcs } from "@/lib/ics";

// "Agregar a mi calendario": el navegador baja el .ics y lo abre con Google Calendar, el iPhone u Outlook.
export async function GET(req: Request, ctx: RouteContext<"/cita/[token]/calendario.ics">) {
  const { token } = await ctx.params;
  const r = await citaPorToken(token);
  if (!r) return new Response("No encontrada", { status: 404 });
  const { cita, negocio, direccion, citaId } = r;
  const ics = construirIcs({
    uid: `${citaId}@agendia`,
    inicio: cita.inicio,
    fin: cita.fin,
    resumen: `${cita.servicioNombre} en ${negocio.nombre}`,
    descripcion: `Con ${cita.staffNombre}. A nombre de ${cita.cliente.nombre}.\nTu cita: ${new URL(`/cita/${token}`, req.url).toString()}`,
    ubicacion: [cita.sedeNombre, direccion].filter(Boolean).join(" · "),
    alarmaMin: 60,
  });
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="cita.ics"', "Cache-Control": "private, no-store" },
  });
}
