"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelarCita } from "@/app/actions-cita";

/** Cancelar con confirmación (dos toques, para que nadie cancele sin querer). */
export function CancelarCita({ token }: { token: string }) {
  const router = useRouter();
  const [seguro, setSeguro] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function cancelar() {
    setEnviando(true);
    setError("");
    const r = await cancelarCita(token).catch(() => ({ ok: false as const, error: "No pudimos conectar. Intenta de nuevo." }));
    if (r.ok) return router.refresh();
    setError(r.error);
    setEnviando(false);
  }

  if (!seguro) return <button type="button" onClick={() => setSeguro(true)} className="boton-claro w-full">Cancelar mi cita</button>;
  return (
    <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <p className="text-sm font-semibold text-red-900">¿Seguro que quieres cancelar tu cita?</p>
      {error && <p role="alert" className="aviso-error">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={cancelar} disabled={enviando} className="boton flex-1 !bg-red-700">{enviando ? "Cancelando…" : "Sí, cancelar"}</button>
        <button type="button" onClick={() => setSeguro(false)} disabled={enviando} className="boton-claro flex-1">No, volver</button>
      </div>
    </div>
  );
}
