"use client";

import { useState } from "react";
import { unirseListaEspera } from "@/app/actions-cita";

/** "¿No hay hora el día que quieres?": el cliente deja su aviso y le escribimos si se libera algo. */
export function EsperaForm({ slug, sedeId, servicioId, hoy, maxFecha }: { slug: string; sedeId: string; servicioId: string; hoy: string; maxFecha: string }) {
  const [fecha, setFecha] = useState("");
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [trampa, setTrampa] = useState("");
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    const r = await unirseListaEspera(slug, { servicioId, sedeId, fecha, cliente: { nombre, whatsapp, email }, trampa }).catch(() => ({ ok: false as const, error: "No pudimos conectar. Intenta de nuevo." }));
    setEnviando(false);
    if (r.ok) setListo(true);
    else setError(r.error);
  }

  return (
    <details className="rounded-xl border border-black/10 p-3">
      <summary className="toque cursor-pointer text-sm font-semibold text-brand">¿No hay hora el día que quieres? Avísame si se libera algo</summary>
      {listo ? (
        <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Listo, quedaste en la lista de espera. Si alguien cancela y se libera una hora ese día, te avisamos con un enlace para reservarla.</p>
      ) : (
        <form onSubmit={enviar} className="mt-3 space-y-3">
          <label className="block text-sm font-medium">
            ¿Qué día?
            <input required type="date" min={hoy} max={maxFecha} value={fecha} onChange={(e) => setFecha(e.target.value)} className="campo" />
          </label>
          <label className="block text-sm font-medium">
            Tu nombre
            <input required autoComplete="name" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} className="campo" />
          </label>
          <label className="block text-sm font-medium">
            Tu WhatsApp
            <input required type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="300 123 4567" className="campo" />
          </label>
          <label className="block text-sm font-medium">
            Correo <span className="font-normal text-black/50">(opcional)</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="campo" />
          </label>
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>Web<input tabIndex={-1} autoComplete="off" value={trampa} onChange={(e) => setTrampa(e.target.value)} /></label>
          </div>
          {error && <p role="alert" className="aviso-error">{error}</p>}
          <button type="submit" className="boton w-full" disabled={enviando}>{enviando ? "Guardando…" : "Avisarme"}</button>
        </form>
      )}
    </details>
  );
}
