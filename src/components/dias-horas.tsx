"use client";

import type { Resultado } from "@/lib/disponibilidad-datos";
import { fechaLarga, horaAmpm } from "@/lib/format";

export type Hora = { hora: string; inicio: number; asignado: string };

const diaCorto = (f: string) => {
  const [y, m, d] = f.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-CO", { ...o, timeZone: "UTC" }).format(dt);
  return { dia: fmt({ weekday: "short" }).replace(".", ""), num: fmt({ day: "numeric" }), mes: fmt({ month: "short" }).replace(".", "") };
};

/** Días con cupo (en una tira que se desliza) y las horas libres del día elegido. Lo usan la reserva y el cambio de hora. */
export function DiasYHoras({ res, fecha, cargando, onDia, onHora }: { res: Resultado | null; fecha: string | null; cargando: boolean; onDia: (d: string) => void; onHora: (h: Hora) => void }) {
  const huecos = res?.ok ? res.huecos : [];
  const dias = res?.ok ? res.dias.slice(0, 14) : [];
  return (
    <>
      {cargando && !res && <p className="text-sm text-black/60" role="status">Buscando horas libres…</p>}
      {res && !res.ok && <p role="alert" className="aviso-error">{res.error}</p>}
      {res?.ok && res.dias.length === 0 && <p className="text-sm text-black/70">Por ahora no hay horas libres. Puedes dejar tu aviso abajo o escribirle al negocio.</p>}
      {res?.ok && res.dias.length > 0 && (
        <>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Días con horas libres">
            {dias.map((d) => {
              const x = diaCorto(d);
              return (
                <button key={d} type="button" data-fecha={d} aria-pressed={d === fecha} disabled={cargando} onClick={() => onDia(d)} className={`toque shrink-0 flex-col rounded-xl px-3 py-2 text-center ${d === fecha ? "bg-brand text-white" : "border border-black/15 hover:border-brand"}`}>
                  <span className="text-xs capitalize">{x.dia}</span>
                  <span className="text-lg font-bold leading-tight">{x.num}</span>
                  <span className="text-xs capitalize">{x.mes}</span>
                </button>
              );
            })}
          </div>
          <div aria-live="polite">
            {fecha && <p className="text-sm font-medium">{fechaLarga(fecha)}</p>}
            {cargando && <p className="mt-2 text-sm text-black/60">Actualizando…</p>}
            {!cargando && huecos.length === 0 && <p className="mt-2 text-sm text-black/70">Ese día ya no tiene horas libres. Elige otro.</p>}
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {huecos.map((h) => (
                <li key={h.inicio}>
                  <button type="button" data-hora={h.hora} disabled={cargando} onClick={() => onHora({ hora: h.hora, inicio: h.inicio, asignado: h.asignado })} className="toque w-full justify-center rounded-lg border border-black/15 py-2 text-sm font-semibold hover:border-brand hover:bg-brand/5">
                    {horaAmpm(h.hora)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
