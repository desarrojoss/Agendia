import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getMember } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default async function Login() {
  if (await getMember()) redirect("/panel");
  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-4 py-10">
      <div>
        <p className="text-2xl font-bold text-brand">Agendia</p>
        <h1 className="mt-1 text-xl font-semibold">Entra a tu agenda</h1>
      </div>
      <LoginForm />
    </main>
  );
}
