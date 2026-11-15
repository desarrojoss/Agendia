import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReservaFlow } from "@/components/reserva-flow";
import { consultar } from "@/lib/disponibilidad-datos";
import { hoyLocal } from "@/lib/disponibilidad";
import { esFecha, sumarDias } from "@/lib/tiempo";
import type { Inicial } from "@/components/reserva-flow";
import { datosPublicos, negocioPorSlug, vistaPublica } from "@/lib/publico";

export async function generateMetadata(props: PageProps<"/[slug]">): Promise<Metadata> {
  const r = await negocioPorSlug((await props.params).slug);
  return { title: r ? `Reserva en ${r.negocio.nombre}` : "No encontrado", description: r ? `Reserva tu cita en ${r.negocio.nombre} en menos de un minuto.` : undefined };
}

// Página pública del negocio: aquí el cliente reserva solo, desde el celular, a cualquier hora.
export default async function PaginaNegocio(props: PageProps<"/[slug]">) {
  const r = await negocioPorSlug((await props.params).slug);
  if (!r) notFound();
  const negocio = vistaPublica(r.negocio);
  const { sedes, servicios, personal } = await datosPublicos(r.bizId);
  const hoy = hoyLocal(negocio.zona);
  const q = await props.searchParams;
  const uno = (x: string | string[] | undefined) => (typeof x === "string" ? x : "");

  // Enlace de un aviso de lista de espera: llega con sede, servicio, día y hora ya elegidos.
  let inicial: Inicial | undefined;
  const [sedeId, servicioId, fecha] = [uno(q.sede), uno(q.servicio), uno(q.fecha)];
  if (sedeId && servicioId && esFecha(fecha) && sedes.some((s) => s.id === sedeId) && servicios.some((s) => s.id === servicioId)) {
    const equipo = personal.filter((p) => p.sedeId === sedeId && p.servicios.includes(servicioId));
    const res = equipo.length ? await consultar(r.bizId, { servicioId, sedeId, staffId: equipo.length === 1 ? equipo[0].id : "cualquiera", fecha }) : null;
    if (res?.ok) {
      const h = res.huecos.find((x) => x.hora === uno(q.hora));
      inicial = { sedeId, servicioId, fecha, res, hora: h ? { hora: h.hora, inicio: h.inicio, asignado: h.asignado } : null };
    }
  }
  const listo = sedes.length > 0 && servicios.length > 0 && personal.length > 0;

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-5 px-4 py-8">
      <header className="flex items-center gap-4">
        {negocio.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={negocio.logoUrl.replace("/upload/", "/upload/c_fill,w_128,h_128,f_auto,q_auto/")} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">{negocio.nombre}</h1>
          {negocio.direccion && <p className="text-sm text-black/60">{negocio.direccion}</p>}
        </div>
      </header>
      <p className="text-black/70">Reserva tu cita en menos de un minuto, a cualquier hora.</p>

      {listo ? (
        <ReservaFlow slug={negocio.slug} sedes={sedes} servicios={servicios} personal={personal} hoy={hoy} maxFecha={sumarDias(hoy, r.negocio.reglas.ventanaDias)} inicial={inicial} />
      ) : (
        <p className="caja text-black/70">Este negocio está preparando su agenda. Vuelve pronto.</p>
      )}

      <footer className="pt-4 text-center text-xs text-black/40">Reservas con Agendia</footer>
    </main>
  );
}
