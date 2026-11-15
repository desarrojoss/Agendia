"use client";

import { useState } from "react";
import { consultarHoras } from "@/app/panel/actions-disponibilidad";
import type { Resultado } from "@/lib/disponibilidad-datos";
import type { Con, Personal, Sede, Servicio } from "@/lib/types";

const fechaCorta = (f: string) => {
  const [y, m, d] = f.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
};

export function DisponibilidadPrevia({ sedes, servicios, personal, hoy }: { sedes: Con<Sede>[]; servicios: Con<Servicio>[]; personal: Con<Personal>[]; hoy: string }) {
  const [sedeId, setSedeId] = useState(sedes[0]?.id ?? "");
  const delaSede = servicios.filter((s) => s.sedes.includes(sedeId));
  const [servicioId, setServicioId] = useState(delaSede[0]?.id ?? "");
  const [staffId, setStaffId] = useState("cualquiera");
  const [fecha, setFecha] = useState(hoy);
  const [res, setRes] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(false);

  const servicioValido = delaSede.some((s) => s.id === servicioId) ? servicioId : (delaSede[0]?.id ?? "");
  const equipo = personal.filter((p) => p.sedeId === sedeId && p.servicios.includes(servicioValido));

  async function ver(f = fecha) {
    setCargando(true);
    setFecha(f);
    setRes(await consultarHoras({ servicioId: servicioValido, sedeId, staffId: equipo.some((p) => p.id === staffId) ? staffId : "cualquiera", fecha: f }).catch(() => ({ ok: false as const, error: "No pudimos conectar." })));
    setCargando(false);
  }

  if (!servicios.length || !personal.length) return <p className="caja text-black/70">Para probar, primero crea un servicio y agrega a un profesional con su horario.</p>;

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); ver(); }} className="caja space-y-4">
        {sedes.length > 1 && (
          <label className="block text-sm font-medium">
            Sede
            <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} className="campo">{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
          </label>
        )}
        <label className="block text-sm font-medium">
          Servicio
          <select value={servicioValido} onChange={(e) => setServicioId(e.target.value)} className="campo">{delaSede.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
        </label>
        <label className="block text-sm font-medium">
          Profesional
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="campo">
            <option value="cualquiera">Cualquiera</option>
            {equipo.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Fecha
          <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className="campo" />
        </label>
        <button type="submit" className="boton w-full" disabled={cargando}>{cargando ? "Calculando…" : "Ver horas libres"}</button>
      </form>

      {res && !res.ok && <p role="alert" className="aviso-error">{res.error}</p>}
      {res?.ok && (
        <>
          <section className="caja space-y-3" aria-live="polite">
            <h2 className="font-semibold">{fechaCorta(fecha)}: {res.huecos.length ? `${res.huecos.length} horas libres` : "sin horas libres"}</h2>
            {res.huecos.length === 0 && <p className="text-sm text-black/70">Ese día no hay cupo: puede que no trabajen, esté bloqueado, lleno o fuera de la ventana de reserva.</p>}
            <ul className="flex flex-wrap gap-2">
              {res.huecos.map((h) => (
                <li key={h.inicio} data-hora={h.hora} className="rounded-lg bg-brand/10 px-3 py-2 text-center text-sm font-semibold text-brand-dark">
                  {h.hora}
                  {staffId === "cualquiera" && <span className="block text-xs font-normal text-black/60">{res.personal[h.asignado]}</span>}
                </li>
              ))}
            </ul>
          </section>
          <section className="caja space-y-3">
            <h2 className="font-semibold">Próximos días con cupo</h2>
            {res.dias.length === 0 && <p className="text-sm text-black/70">No hay días con cupo en la ventana de reserva.</p>}
            <ul className="flex flex-wrap gap-2">
              {res.dias.slice(0, 14).map((d) => (
                <li key={d}>
                  <button type="button" onClick={() => ver(d)} className={`rounded-lg px-3 py-2 text-sm ${d === fecha ? "bg-brand text-white" : "bg-white ring-1 ring-black/15 hover:bg-black/5"}`}>{fechaCorta(d)}</button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
