import type { Metadata } from "next";
import Link from "next/link";
import { AccionesServicio } from "@/components/acciones-fila";
import { requireDueno } from "@/lib/auth-server";
import { listarSedes, listarServicios } from "@/lib/datos";
import { cop, duracion, textoAnticipo } from "@/lib/format";

export const metadata: Metadata = { title: "Servicios", robots: { index: false } };

export default async function Servicios() {
  const s = await requireDueno();
  const [servicios, sedes] = await Promise.all([listarServicios(s.bizId), listarSedes(s.bizId)]);
  const nombreSede = new Map(sedes.map((x) => [x.id, x.nombre]));
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Servicios</h1>
        <Link href="/panel/servicios/nuevo" className="boton">+ Nuevo</Link>
      </div>
      {servicios.length === 0 && <p className="caja text-black/70">Aún no tienes servicios. Crea el primero: es lo que tus clientes van a reservar.</p>}
      <ul className="space-y-3">
        {servicios.map((x, i) => (
          <li key={x.id} className={`caja space-y-2 ${x.activo ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/panel/servicios/${x.id}`} className="font-semibold underline-offset-2 hover:underline">{x.nombre}</Link>
                {!x.activo && <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs">Oculto</span>}
                <p className="text-sm text-black/70">{duracion(x.duracionMin)} · {x.precio ? cop(x.precio) : "Gratis"} · {textoAnticipo(x.anticipo, x.precio)}</p>
                {sedes.length > 1 && <p className="text-xs text-black/50">{x.sedes.map((id) => nombreSede.get(id) ?? "—").join(", ")}</p>}
              </div>
              <Link href={`/panel/servicios/${x.id}`} className="boton-claro !min-h-9 !px-3 text-sm">Editar</Link>
            </div>
            <AccionesServicio id={x.id} activo={x.activo} primero={i === 0} ultimo={i === servicios.length - 1} />
          </li>
        ))}
      </ul>
    </>
  );
}
