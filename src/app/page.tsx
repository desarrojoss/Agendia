import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-5 p-6 text-center">
      <h1 className="text-4xl font-bold text-brand">Agendia</h1>
      <p className="text-lg">Reservas en línea para tu negocio. Tus clientes reservan solos, a cualquier hora.</p>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/registro" className="boton">Crea tu agenda gratis</Link>
        <Link href="/login" className="boton-claro">Entrar</Link>
      </div>
    </main>
  );
}
