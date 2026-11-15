import type { Metadata } from "next";
import { headers } from "next/headers";
import { cerrarSesion } from "@/app/actions-auth";
import { negocioRef, requireMember } from "@/lib/auth-server";
import type { Negocio } from "@/lib/types";

export const metadata: Metadata = { title: "Panel", robots: { index: false } };

const PASOS = [
  { titulo: "Nombre y enlace de tu negocio", hecho: true },
  { titulo: "Tus servicios", hecho: false },
  { titulo: "Profesionales y horarios", hecho: false },
  { titulo: "Comparte tu enlace", hecho: false },
];

export default async function Panel() {
  // El negocio sale SIEMPRE de la sesión (members/{uid}), nunca de la URL ni de un dato del cliente.
  const s = await requireMember();
  const negocio = (await negocioRef(s.bizId).get()).data() as Negocio;
  const host = (await headers()).get("host") ?? "";
  const enlace = `${host}/${negocio.slug}`;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <p className="text-xl font-bold text-brand">Agendia</p>
        <form action={cerrarSesion}>
          <button className="boton-claro">Salir</button>
        </form>
      </header>

      <section className="caja space-y-1">
        <p className="text-sm text-black/60">{s.rol === "dueno" ? "Dueño" : "Profesional"} · {s.email}</p>
        <h1 className="text-2xl font-bold">{negocio.nombre}</h1>
        <p className="text-sm">
          Tu enlace: <a href={`/${negocio.slug}`} className="font-semibold text-brand underline">{enlace}</a>
        </p>
      </section>

      <section className="caja">
        <h2 className="font-semibold">Deja lista tu agenda</h2>
        <ol className="mt-3 space-y-2">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="flex items-center gap-3">
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${p.hecho ? "bg-brand text-white" : "border border-black/20"}`}>
                {p.hecho ? "✓" : i + 1}
              </span>
              <span className={p.hecho ? "" : "text-black/60"}>{p.titulo}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
