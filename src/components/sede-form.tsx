"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { guardarSede } from "@/app/panel/actions-config";
import type { Sede } from "@/lib/types";

export function SedeForm({ id, inicial }: { id: string | null; inicial: Sede | null }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [direccion, setDireccion] = useState(inicial?.direccion ?? "");
  const [whatsapp, setWhatsapp] = useState(inicial?.whatsapp ?? "");
  const [activo, setActivo] = useState(inicial?.activo ?? true);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    const r = await guardarSede(id, { nombre, direccion, whatsapp, activo }).catch(() => ({ ok: false as const, error: "No pudimos conectar. Intenta de nuevo." }));
    if (!r.ok) {
      setError(r.error);
      setCargando(false);
      return;
    }
    router.push("/panel/sedes");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="caja space-y-4">
      <label className="block text-sm font-medium">
        Nombre de la sede
        <input required maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Sede Centro" className="campo" />
      </label>
      <label className="block text-sm font-medium">
        Dirección <span className="font-normal text-black/50">(opcional)</span>
        <input maxLength={120} value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Cra 45 # 70-20, Barranquilla" className="campo" />
      </label>
      <label className="block text-sm font-medium">
        WhatsApp de esta sede <span className="font-normal text-black/50">(opcional; si lo dejas vacío se usa el del negocio)</span>
        <input type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="300 123 4567" className="campo" />
      </label>
      <label className="toque flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="size-5" />
        Sede activa
      </label>
      {error && <p role="alert" className="aviso-error">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" className="boton flex-1" disabled={cargando}>{cargando ? "Guardando…" : "Guardar"}</button>
        <Link href="/panel/sedes" className="boton-claro">Cancelar</Link>
      </div>
    </form>
  );
}
