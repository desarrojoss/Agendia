import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SedeForm } from "@/components/sede-form";
import { requireDueno } from "@/lib/auth-server";
import { listarSedes } from "@/lib/datos";

export const metadata: Metadata = { title: "Sede", robots: { index: false } };

export default async function EditarSede(props: PageProps<"/panel/sedes/[id]">) {
  const s = await requireDueno();
  const { id } = await props.params;
  const sedes = await listarSedes(s.bizId);
  const inicial = id === "nuevo" ? null : sedes.find((x) => x.id === id);
  if (inicial === undefined) notFound();
  return (
    <>
      <h1 className="text-xl font-bold">{inicial ? "Editar sede" : "Nueva sede"}</h1>
      <SedeForm key={id} id={inicial ? id : null} inicial={inicial} />
    </>
  );
}
