import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PersonalForm } from "@/components/personal-form";
import { requireDueno } from "@/lib/auth-server";
import { listarPersonal, listarSedes, listarServicios } from "@/lib/datos";

export const metadata: Metadata = { title: "Profesional", robots: { index: false } };

export default async function EditarPersonal(props: PageProps<"/panel/equipo/[id]">) {
  const s = await requireDueno();
  const { id } = await props.params;
  const [sedes, servicios, personal] = await Promise.all([listarSedes(s.bizId), listarServicios(s.bizId), listarPersonal(s.bizId)]);
  const inicial = id === "nuevo" ? null : personal.find((x) => x.id === id);
  if (inicial === undefined) notFound();
  return (
    <>
      <h1 className="text-xl font-bold">{inicial ? "Editar profesional" : "Agregar profesional"}</h1>
      <PersonalForm key={id} id={inicial ? id : null} inicial={inicial} sedes={sedes} servicios={servicios.filter((x) => x.activo)} />
    </>
  );
}
