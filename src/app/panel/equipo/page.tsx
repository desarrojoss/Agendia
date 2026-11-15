import type { Metadata } from "next";
import Link from "next/link";
import { AccionesPersonal } from "@/components/acciones-fila";
import { requireDueno } from "@/lib/auth-server";
import { listarPersonal, listarSedes, listarServicios } from "@/lib/datos";
import { DIAS } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Equipo", robots: { index: false } };

export default async function Equipo() {
  const s = await requireDueno();
  const [personal, sedes, servicios] = await Promise.all([listarPersonal(s.bizId), listarSedes(s.bizId), listarServicios(s.bizId)]);
  const nombreSede = new Map(sedes.map((x) => [x.id, x.nombre]));
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Equipo</h1>
        <Link href="/panel/equipo/nuevo" className="boton">+ Agregar</Link>
      </div>
      {personal.length === 0 && <p className="caja text-black/70">Agrega a quienes atienden (o a ti mismo): cada uno con su horario y los servicios que ofrece.</p>}
      <ul className="space-y-3">
        {personal.map((p) => {
          const dias = DIAS.filter((d) => p.horario[d].length).length;
          return (
            <li key={p.id} className={`caja space-y-2 ${p.activo ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-3">
                <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-black/5 text-lg font-bold text-black/40">
                  {p.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.fotoUrl.replace("/upload/", "/upload/c_fill,w_112,h_112,f_auto,q_auto/")} alt="" className="size-full object-cover" />
                  ) : (
                    p.nombre[0]
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/panel/equipo/${p.id}`} className="font-semibold underline-offset-2 hover:underline">{p.nombre}</Link>
                  {!p.activo && <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs">Inactivo</span>}
                  <p className="text-sm text-black/70">
                    {p.servicios.filter((id) => servicios.some((x) => x.id === id)).length} servicios · {dias} días a la semana{sedes.length > 1 ? ` · ${nombreSede.get(p.sedeId) ?? "—"}` : ""}
                  </p>
                </div>
                <Link href={`/panel/equipo/${p.id}`} className="boton-claro !min-h-9 !px-3 text-sm">Editar</Link>
              </div>
              <AccionesPersonal id={p.id} activo={p.activo} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
