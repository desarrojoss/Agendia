import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/firebase-admin";
import type { Negocio } from "@/lib/types";

// Página pública del negocio. Por ahora solo el encabezado: la reserva llega en la ejecución 4.
async function buscar(slug: string) {
  const db = getDb();
  const s = await db.collection("slugs").doc(slug).get();
  if (!s.exists) return null;
  const n = await db.collection("businesses").doc(s.data()!.bizId).get();
  const negocio = n.data() as Negocio | undefined;
  return negocio && !negocio.suspendido ? negocio : null;
}

export async function generateMetadata(props: PageProps<"/[slug]">): Promise<Metadata> {
  const negocio = await buscar((await props.params).slug);
  return { title: negocio ? `Reserva en ${negocio.nombre}` : "No encontrado" };
}

export default async function PaginaNegocio(props: PageProps<"/[slug]">) {
  const negocio = await buscar((await props.params).slug);
  if (!negocio) notFound();
  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-10 text-center">
      <h1 className="text-3xl font-bold">{negocio.nombre}</h1>
      <p className="text-black/70">Muy pronto podrás reservar tu cita aquí.</p>
    </main>
  );
}
