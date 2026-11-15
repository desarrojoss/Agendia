import type { Metadata } from "next";
import Link from "next/link";
import { requireDueno } from "@/lib/auth-server";
import { listarSedes } from "@/lib/datos";

export const metadata: Metadata = { title: "Sedes", robots: { index: false } };

export default async function Sedes() {
  const s = await requireDueno();
  const sedes = await listarSedes(s.bizId);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Sedes</h1>
        <Link href="/panel/sedes/nuevo" className="boton">+ Nueva</Link>
      </div>
      <p className="text-sm text-black/70">Si tu negocio tiene varias sedes, tus clientes eligen primero dónde quieren la cita. Con una sola, ni la ven.</p>
      <ul className="space-y-3">
        {sedes.map((x) => (
          <li key={x.id} className={`caja flex items-center justify-between gap-3 ${x.activo ? "" : "opacity-60"}`}>
            <div className="min-w-0">
              <p className="font-semibold">{x.nombre}{!x.activo && <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs font-normal">Inactiva</span>}</p>
              <p className="truncate text-sm text-black/70">{x.direccion || "Sin dirección"}</p>
            </div>
            <Link href={`/panel/sedes/${x.id}`} className="boton-claro !min-h-9 !px-3 text-sm">Editar</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
