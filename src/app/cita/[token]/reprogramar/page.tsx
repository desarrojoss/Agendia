import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReprogramarFlow } from "@/components/reprogramar-flow";
import { citaPorToken } from "@/lib/citas-publico";
import { consultar } from "@/lib/disponibilidad-datos";
import { hoyLocal } from "@/lib/disponibilidad";
import { fechaHoraLarga } from "@/lib/format";

export const metadata: Metadata = { title: "Cambiar mi cita", robots: { index: false, follow: false } };

export default async function Reprogramar(props: PageProps<"/cita/[token]/reprogramar">) {
  const { token } = await props.params;
  const r = await citaPorToken(token);
  if (!r) notFound();
  if (!r.gestion.reprogramar) redirect(`/cita/${token}`);
  const { bizId, citaId, cita, negocio } = r;
  const consulta = (fecha: string) => consultar(bizId, { servicioId: cita.servicioId, sedeId: cita.sedeId, staffId: cita.staffId, fecha, ignorarCitaId: citaId });
  // se abre en el primer día con cupo
  let fecha = hoyLocal(negocio.zona);
  let res = await consulta(fecha);
  if (res.ok && res.huecos.length === 0 && res.dias[0] && res.dias[0] !== fecha) {
    fecha = res.dias[0];
    res = await consulta(fecha);
  }
  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-5 px-4 py-8">
      <h1 className="text-xl font-bold">Cambiar mi cita</h1>
      <p className="caja text-sm">
        <strong>{cita.servicioNombre}</strong> con {cita.staffNombre}<br />
        Ahora: {fechaHoraLarga(cita.inicio, negocio.zona)}
      </p>
      <ReprogramarFlow token={token} fechaInicial={fecha} resInicial={res} />
      <p className="text-center"><Link href={`/cita/${token}`} className="text-sm font-semibold text-brand underline">Volver a mi cita</Link></p>
    </main>
  );
}
