"use server";

import { requireDueno } from "@/lib/auth-server";
import { consultar, type Consulta, type Resultado } from "@/lib/disponibilidad-datos";
import { esFecha } from "@/lib/tiempo";

/** Vista previa para el dueño: qué horas vería hoy un cliente con la configuración actual. El negocio sale de la sesión. */
export async function consultarHoras(c: Consulta): Promise<Resultado> {
  const s = await requireDueno();
  if (!c.servicioId || !c.sedeId || !c.staffId || !esFecha(c.fecha)) return { ok: false, error: "Elige servicio, sede, profesional y fecha." };
  return consultar(s.bizId, { servicioId: c.servicioId, sedeId: c.sedeId, staffId: c.staffId, fecha: c.fecha });
}
