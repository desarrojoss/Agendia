"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { horasReprogramar, reprogramarCita } from "@/app/actions-cita";
import { DiasYHoras, type Hora } from "@/components/dias-horas";
import type { Resultado } from "@/lib/disponibilidad-datos";
import { fechaLarga, horaAmpm } from "@/lib/format";

/** Cambiar la hora de la cita: mismo servicio y profesional, otro día u hora. */
export function ReprogramarFlow({ token, fechaInicial, resInicial }: { token: string; fechaInicial: string; resInicial: Resultado }) {
  const router = useRouter();
  const [fecha, setFecha] = useState(fechaInicial);
  const [res, setRes] = useState<Resultado>(resInicial);
  const [hora, setHora] = useState<Hora | null>(null);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function cargar(f: string) {
    setCargando(true);
    setHora(null);
    const r = await horasReprogramar(token, f).catch(() => ({ ok: false as const, error: "No pudimos conectar. Intenta de nuevo." }));
    setFecha(f);
    setRes(r);
    setCargando(false);
  }

  async function confirmar() {
    if (!hora) return;
    setEnviando(true);
    setError("");
    const r = await reprogramarCita(token, fecha, hora.hora).catch(() => ({ ok: false as const, error: "No pudimos conectar. Intenta de nuevo." }));
    if (r.ok) return router.push(`/cita/${token}?movida=1`);
    setError(r.error);
    setEnviando(false);
    if (/disponible|reservada/.test(r.error)) cargar(fecha);
  }

  return (
    <div className="space-y-4">
      <section className="caja space-y-3">
        <h2 className="font-semibold">Elige el nuevo día y la hora</h2>
        {error && <p role="alert" className="aviso-error">{error}</p>}
        <DiasYHoras res={res} fecha={fecha} cargando={cargando} onDia={cargar} onHora={(h) => { setError(""); setHora(h); }} />
      </section>
      {hora && (
        <section className="caja space-y-3">
          <p className="text-sm">Nueva hora: <strong>{fechaLarga(fecha)}, {horaAmpm(hora.hora)}</strong></p>
          <button type="button" onClick={confirmar} disabled={enviando} className="boton w-full">{enviando ? "Cambiando…" : "Confirmar el cambio"}</button>
        </section>
      )}
    </div>
  );
}
