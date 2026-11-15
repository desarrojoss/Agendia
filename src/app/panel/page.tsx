import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { CopiarEnlace } from "@/components/copiar-enlace";
import { requireMember } from "@/lib/auth-server";
import { getNegocio, listarPersonal, listarServicios } from "@/lib/datos";
import { DIAS } from "@/lib/tiempo";

export const metadata: Metadata = { title: "Resumen", robots: { index: false } };

export default async function Resumen() {
  // El negocio sale SIEMPRE de la sesión (members/{uid}), nunca de la URL ni de un dato del cliente.
  const s = await requireMember();
  const [negocio, servicios, personal, host] = await Promise.all([getNegocio(s.bizId), listarServicios(s.bizId), listarPersonal(s.bizId), headers().then((h) => h.get("host") ?? "")]);
  const protocolo = host.startsWith("localhost") ? "http" : "https";
  const url = `${protocolo}://${host}/${negocio.slug}`;

  const tieneServicios = servicios.some((x) => x.activo);
  const tienePersonal = personal.some((p) => p.activo && DIAS.some((d) => p.horario[d].length));
  const listo = tieneServicios && tienePersonal;
  const pasos = [
    { titulo: "Nombre y enlace de tu negocio", hecho: true, href: "/panel/negocio" },
    { titulo: "Tus servicios", hecho: tieneServicios, href: "/panel/servicios/nuevo", accion: "Crear servicio" },
    { titulo: "Profesionales y horarios", hecho: tienePersonal, href: "/panel/equipo/nuevo", accion: "Agregar profesional" },
    { titulo: "Comparte tu enlace", hecho: listo },
  ];

  return (
    <>
      <section className="caja space-y-1">
        <p className="text-sm text-black/60">{s.rol === "dueno" ? "Dueño" : "Profesional"} · {s.email}</p>
        <h1 className="text-2xl font-bold">{negocio.nombre}</h1>
        <p className="break-all text-sm">
          Tu enlace: <a href={`/${negocio.slug}`} className="font-semibold text-brand underline">{url}</a>
        </p>
      </section>

      {s.rol === "dueno" && (
        <section className="caja">
          <h2 className="font-semibold">{listo ? "Tu agenda está lista" : "Deja lista tu agenda"}</h2>
          <ol className="mt-3 space-y-3">
            {pasos.map((p, i) => (
              <li key={p.titulo} className="flex items-center gap-3">
                <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${p.hecho ? "bg-brand text-white" : "border border-black/20"}`}>{p.hecho ? "✓" : i + 1}</span>
                <span className={`flex-1 ${p.hecho ? "" : "text-black/70"}`}>{p.titulo}</span>
                {!p.hecho && p.accion && <Link href={p.href!} className="boton !min-h-9 !px-3 text-sm">{p.accion}</Link>}
              </li>
            ))}
          </ol>
          {listo ? (
            <div className="mt-4 space-y-2 border-t border-black/10 pt-4">
              <p className="text-sm">Ya puedes compartir tu enlace con tus clientes. La reserva en línea se activa en la siguiente entrega.</p>
              <CopiarEnlace url={url} whatsappTexto={`Reserva tu cita en ${negocio.nombre}: ${url}`} />
            </div>
          ) : (
            <p className="mt-4 border-t border-black/10 pt-4 text-sm text-black/60">Cuando termines los pasos 2 y 3, aquí aparecerá tu enlace listo para compartir.</p>
          )}
        </section>
      )}

      <section className="grid grid-cols-3 gap-3 text-center">
        <div className="caja !p-3"><p className="text-2xl font-bold">{servicios.filter((x) => x.activo).length}</p><p className="text-xs text-black/60">Servicios</p></div>
        <div className="caja !p-3"><p className="text-2xl font-bold">{personal.filter((x) => x.activo).length}</p><p className="text-xs text-black/60">Profesionales</p></div>
        <div className="caja !p-3"><p className="text-2xl font-bold">0</p><p className="text-xs text-black/60">Citas hoy</p></div>
      </section>
    </>
  );
}
