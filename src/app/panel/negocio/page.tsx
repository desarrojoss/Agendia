import type { Metadata } from "next";
import { headers } from "next/headers";
import { NegocioForm } from "@/components/negocio-form";
import { requireDueno } from "@/lib/auth-server";
import { getNegocio } from "@/lib/datos";

export const metadata: Metadata = { title: "Negocio", robots: { index: false } };

export default async function Negocio() {
  const s = await requireDueno();
  const [negocio, host] = await Promise.all([getNegocio(s.bizId), headers().then((h) => h.get("host") ?? "")]);
  return (
    <>
      <h1 className="text-xl font-bold">Tu negocio</h1>
      <NegocioForm key={negocio.slug + negocio.nombre} inicial={negocio} host={host} />
    </>
  );
}
