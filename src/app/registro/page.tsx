import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RegistroForm } from "@/components/registro-form";
import { getMember } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Crea tu agenda" };

export default async function Registro() {
  if (await getMember()) redirect("/panel");
  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 py-10">
      <div>
        <p className="text-2xl font-bold text-brand">Agendia</p>
        <h1 className="mt-1 text-xl font-semibold">Crea tu agenda en 2 minutos</h1>
        <p className="mt-1 text-sm text-black/70">Tus clientes reservan solos, a cualquier hora. Es gratis.</p>
      </div>
      <RegistroForm host={(await headers()).get("host") ?? "agendia"} />
    </main>
  );
}
