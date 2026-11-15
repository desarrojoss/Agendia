"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { crearBloqueo, eliminarBloqueo } from "@/app/panel/actions-config";
import { sumarDias } from "@/lib/tiempo";
import type { Con, Personal, Sede } from "@/lib/types";

const hoy = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10); // fecha de hoy en Bogotá (UTC-5)

export function BloqueoForm({ sedes, personal }: { sedes: Con<Sede>[]; personal: Con<Personal>[] }) {
  const router = useRouter();
  const [alcance, setAlcance] = useState<"negocio" | "sede" | "personal">("negocio");
  const [sedeId, setSedeId] = useState(sedes[0]?.id ?? "");
  const [staffId, setStaffId] = useState(personal[0]?.id ?? "");
  const [desdeFecha, setDesdeFecha] = useState(hoy());
  const [hastaFecha, setHastaFecha] = useState(hoy());
  const [diaCompleto, setDiaCompleto] = useState(true);
  const [desdeHora, setDesdeHora] = useState("12:00");
  const [hastaHora, setHastaHora] = useState("14:00");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    // "Día completo" bloquea desde las 00:00 del primer día hasta las 00:00 del día siguiente al último
    const r = await crearBloqueo({
      alcance, sedeId, staffId, motivo, desdeFecha,
      desdeHora: diaCompleto ? "00:00" : desdeHora,
      hastaFecha: diaCompleto ? sumarDias(hastaFecha, 1) : hastaFecha,
      hastaHora: diaCompleto ? "00:00" : hastaHora,
    }).catch(() => ({ ok: false as const, error: "No pudimos conectar. Intenta de nuevo." }));
    setCargando(false);
    if (!r.ok) return setError(r.error);
    setMotivo("");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="caja space-y-4">
      <h2 className="font-semibold">Bloquear horas o días</h2>
      <label className="block text-sm font-medium">
        ¿A quién aplica?
        <select value={alcance} onChange={(e) => setAlcance(e.target.value as typeof alcance)} className="campo">
          <option value="negocio">A todo el negocio (festivos, cierre)</option>
          {sedes.length > 1 && <option value="sede">A una sede</option>}
          {personal.length > 0 && <option value="personal">A una persona (vacaciones, cita médica)</option>}
        </select>
      </label>
      {alcance === "sede" && (
        <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} className="campo" aria-label="Sede">
          {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      )}
      {alcance === "personal" && (
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="campo" aria-label="Persona">
          {personal.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          Desde el
          <input type="date" required value={desdeFecha} onChange={(e) => { setDesdeFecha(e.target.value); if (hastaFecha < e.target.value) setHastaFecha(e.target.value); }} className="campo" />
        </label>
        <label className="block text-sm font-medium">
          Hasta el
          <input type="date" required min={desdeFecha} value={hastaFecha} onChange={(e) => setHastaFecha(e.target.value)} className="campo" />
        </label>
      </div>
      <label className="toque flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={diaCompleto} onChange={(e) => setDiaCompleto(e.target.checked)} className="size-5" />
        Todo el día
      </label>
      {!diaCompleto && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Desde las
            <input type="time" required value={desdeHora} onChange={(e) => setDesdeHora(e.target.value)} className="campo" />
          </label>
          <label className="block text-sm font-medium">
            Hasta las
            <input type="time" required value={hastaHora} onChange={(e) => setHastaHora(e.target.value)} className="campo" />
          </label>
        </div>
      )}
      <label className="block text-sm font-medium">
        Motivo <span className="font-normal text-black/50">(opcional)</span>
        <input maxLength={80} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Vacaciones" className="campo" />
      </label>
      {error && <p role="alert" className="aviso-error">{error}</p>}
      <button type="submit" className="boton w-full" disabled={cargando}>{cargando ? "Guardando…" : "Bloquear"}</button>
    </form>
  );
}

export function QuitarBloqueo({ id }: { id: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  return (
    <button
      className="boton-claro !min-h-9 !px-3 text-sm"
      disabled={cargando}
      onClick={async () => {
        setCargando(true);
        await eliminarBloqueo(id).catch(() => null);
        setCargando(false);
        router.refresh();
      }}
    >
      Quitar
    </button>
  );
}
