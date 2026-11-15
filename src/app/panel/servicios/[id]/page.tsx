import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServicioForm } from "@/components/servicio-form";
import { requireDueno } from "@/lib/auth-server";
import { listarSedes, listarServicios } from "@/lib/datos";

export const metadata: Metadata = { title: "Servicio", robots: { index: false } };

export default async function EditarServicio(props: PageProps<"/panel/servicios/[id]">) {
  const s = await requireDueno();
  const { id } = await props.params;
  const [sedes, servicios] = await Promise.all([listarSedes(s.bizId), listarServicios(s.bizId)]);
  const inicial = id === "nuevo" ? null : servicios.find((x) => x.id === id);
  if (inicial === undefined) notFound(); // un id que no es de ESTE negocio no existe para él
  return (
    <>
      <h1 className="text-xl font-bold">{inicial ? "Editar servicio" : "Nuevo servicio"}</h1>
      <ServicioForm key={id} id={inicial ? id : null} inicial={inicial} sedes={sedes} />
    </>
  );
}
