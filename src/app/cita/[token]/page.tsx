import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { citaPorToken } from "@/lib/citas-publico";
import { cop, duracion, fechaHoraLarga } from "@/lib/format";
import { urlWhatsapp, mensajeReserva } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Tu cita", robots: { index: false, follow: false } };

const ESTADOS = {
  confirmada: { texto: "Confirmada", clase: "bg-emerald-100 text-emerald-800" },
  pendiente_pago: { texto: "Falta pagar el anticipo", clase: "bg-amber-100 text-amber-800" },
  atendida: { texto: "Atendida", clase: "bg-black/10 text-black/70" },
  no_llego: { texto: "No asististe", clase: "bg-black/10 text-black/70" },
  cancelada: { texto: "Cancelada", clase: "bg-red-100 text-red-800" },
} as const;

export default async function Cita(props: PageProps<"/cita/[token]">) {
  const [{ token }, { nueva }] = await Promise.all([props.params, props.searchParams]);
  const r = await citaPorToken(token);
  if (!r) notFound();
  const { cita, negocio, direccion, whatsapp } = r;
  const cuando = fechaHoraLarga(cita.inicio, negocio.zona);
  const estado = ESTADOS[cita.estado];
  const activa = cita.estado === "confirmada" || cita.estado === "pendiente_pago";

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-5 px-4 py-8">
      {nueva && activa && (
        <div role="status" className="rounded-2xl bg-brand p-5 text-white">
          <p className="text-2xl font-bold">¡Listo, {cita.cliente.nombre.split(" ")[0]}!</p>
          <p>{cita.estado === "pendiente_pago" ? "Tu hora quedó reservada. Falta el anticipo para confirmarla." : "Tu cita quedó reservada."}</p>
        </div>
      )}

      <section className="caja space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold">{negocio.nombre}</h1>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${estado.clase}`}>{estado.texto}</span>
        </div>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-black/50">Servicio</dt><dd className="font-semibold">{cita.servicioNombre} · {duracion(cita.duracionMin)} · {cita.precio ? cop(cita.precio) : "Gratis"}</dd></div>
          <div><dt className="text-black/50">Cuándo</dt><dd className="font-semibold">{cuando}</dd></div>
          <div><dt className="text-black/50">Con</dt><dd className="font-semibold">{cita.staffNombre}</dd></div>
          {direccion && <div><dt className="text-black/50">Dónde</dt><dd className="font-semibold">{cita.sedeNombre}{direccion ? ` · ${direccion}` : ""}</dd></div>}
          <div><dt className="text-black/50">A nombre de</dt><dd className="font-semibold">{cita.cliente.nombre}</dd></div>
        </dl>
        {cita.estado === "pendiente_pago" && cita.anticipo > 0 && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Anticipo pendiente: <strong>{cop(cita.anticipo)}</strong>. El pago en línea se activa en la siguiente entrega de Agendia; el negocio te confirma por WhatsApp.</p>
        )}
      </section>

      {activa && (
        <section className="space-y-3">
          <a href={`/cita/${token}/calendario.ics`} className="boton w-full">Agregar a mi calendario</a>
          {whatsapp && (
            <a
              href={urlWhatsapp(whatsapp, mensajeReserva({ negocio: negocio.nombre, servicio: cita.servicioNombre, cuando, profesional: cita.staffNombre, cliente: cita.cliente.nombre }))}
              target="_blank" rel="noreferrer" className="boton-claro w-full"
            >
              Avisar al negocio por WhatsApp
            </a>
          )}
          <p className="text-center text-sm text-black/60">Guarda este enlace: es tu cita. Desde aquí podrás consultarla.</p>
        </section>
      )}

      <p className="text-center"><Link href={`/${negocio.slug}`} className="text-sm font-semibold text-brand underline">Volver a {negocio.nombre}</Link></p>
    </main>
  );
}
