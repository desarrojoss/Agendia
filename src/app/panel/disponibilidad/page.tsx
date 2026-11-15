import type { Metadata } from "next";
import { DisponibilidadPrevia } from "@/components/disponibilidad-previa";
import { requireDueno } from "@/lib/auth-server";
import { hoyLocal } from "@/lib/disponibilidad";
import { getNegocio, listarPersonal, listarSedes, listarServicios } from "@/lib/datos";

export const metadata: Metadata = { title: "Probar disponibilidad", robots: { index: false } };

export default async function Disponibilidad() {
  const s = await requireDueno();
  const [negocio, sedes, servicios, personal] = await Promise.all([getNegocio(s.bizId), listarSedes(s.bizId), listarServicios(s.bizId), listarPersonal(s.bizId)]);
  return (
    <>
      <h1 className="text-xl font-bold">Probar disponibilidad</h1>
      <p className="text-sm text-black/70">Mira qué horas vería hoy un cliente con tu configuración: horarios, pausas, bloqueos, anticipación y citas ya agendadas.</p>
      <DisponibilidadPrevia sedes={sedes.filter((x) => x.activo)} servicios={servicios.filter((x) => x.activo)} personal={personal.filter((x) => x.activo)} hoy={hoyLocal(negocio.zona)} />
    </>
  );
}
