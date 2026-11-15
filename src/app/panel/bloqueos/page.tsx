import type { Metadata } from "next";
import { BloqueoForm, QuitarBloqueo } from "@/components/bloqueo-form";
import { requireDueno } from "@/lib/auth-server";
import { getNegocio, listarBloqueos, listarPersonal, listarSedes } from "@/lib/datos";
import { utcAZona } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Bloqueos", robots: { index: false } };

export default async function Bloqueos() {
  const s = await requireDueno();
  const [negocio, bloqueos, sedes, personal] = await Promise.all([getNegocio(s.bizId), listarBloqueos(s.bizId), listarSedes(s.bizId), listarPersonal(s.bizId)]);
  const sedePorId = new Map(sedes.map((x) => [x.id, x.nombre]));
  const personaPorId = new Map(personal.map((x) => [x.id, x.nombre]));
  const fmt = (ts: number) => {
    const z = utcAZona(ts, negocio.zona);
    return `${z.fecha.split("-").reverse().join("/")} ${z.hora}`;
  };
  return (
    <>
      <h1 className="text-xl font-bold">Bloqueos</h1>
      <p className="text-sm text-black/70">Festivos, vacaciones o una cita médica: en esas horas nadie podrá reservar.</p>
      <BloqueoForm sedes={sedes.filter((x) => x.activo)} personal={personal.filter((x) => x.activo)} />
      <section className="space-y-3">
        <h2 className="font-semibold">Próximos bloqueos</h2>
        {bloqueos.length === 0 && <p className="caja text-black/70">No tienes bloqueos próximos.</p>}
        <ul className="space-y-3">
          {bloqueos.map((b) => (
            <li key={b.id} className="caja flex items-center justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="font-semibold">{b.staffId ? personaPorId.get(b.staffId) ?? "Persona eliminada" : b.sedeId ? sedePorId.get(b.sedeId) ?? "Sede" : "Todo el negocio"}</p>
                <p className="text-black/70">{fmt(b.inicio)} → {fmt(b.fin)}</p>
                {b.motivo && <p className="text-black/50">{b.motivo}</p>}
              </div>
              <QuitarBloqueo id={b.id} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
