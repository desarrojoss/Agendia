"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { alternarPersonal, alternarServicio, moverServicio, type Res } from "@/app/panel/actions-config";

/** Botones chicos de una fila de lista: llaman a una acción y refrescan. Si falla, muestran el motivo. */
function useAccion() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  async function correr(f: () => Promise<Res>) {
    setCargando(true);
    setError("");
    const r = await f().catch(() => ({ ok: false as const, error: "No pudimos conectar." }));
    setCargando(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  }
  return { cargando, error, correr };
}

export function AccionesServicio({ id, activo, primero, ultimo }: { id: string; activo: boolean; primero: boolean; ultimo: boolean }) {
  const { cargando, error, correr } = useAccion();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="boton-claro !min-h-9 !px-3" aria-label="Subir" disabled={cargando || primero} onClick={() => correr(() => moverServicio(id, -1))}>↑</button>
      <button className="boton-claro !min-h-9 !px-3" aria-label="Bajar" disabled={cargando || ultimo} onClick={() => correr(() => moverServicio(id, 1))}>↓</button>
      <button className="boton-claro !min-h-9 !px-3 text-sm" disabled={cargando} onClick={() => correr(() => alternarServicio(id))}>{activo ? "Ocultar" : "Mostrar"}</button>
      {error && <span role="alert" className="text-sm text-red-700">{error}</span>}
    </div>
  );
}

export function AccionesPersonal({ id, activo }: { id: string; activo: boolean }) {
  const { cargando, error, correr } = useAccion();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="boton-claro !min-h-9 !px-3 text-sm" disabled={cargando} onClick={() => correr(() => alternarPersonal(id))}>{activo ? "Desactivar" : "Activar"}</button>
      {error && <span role="alert" className="text-sm text-red-700">{error}</span>}
    </div>
  );
}
