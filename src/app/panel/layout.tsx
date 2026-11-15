import { cerrarSesion } from "@/app/actions-auth";
import { NavPanel } from "@/components/nav-panel";
import { requireMember } from "@/lib/auth-server";
import { getNegocio } from "@/lib/datos";

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  // Toda página del panel pasa por aquí: sin sesión válida de un miembro de un negocio, al login.
  const s = await requireMember();
  const negocio = await getNegocio(s.bizId);
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-brand">Agendia</p>
          <p className="truncate font-semibold">{negocio.nombre}</p>
        </div>
        <form action={cerrarSesion}>
          <button className="boton-claro">Salir</button>
        </form>
      </header>
      <NavPanel esDueno={s.rol === "dueno"} />
      <main className="space-y-5">{children}</main>
    </div>
  );
}
