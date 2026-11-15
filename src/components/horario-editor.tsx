"use client";

import { DIAS, NOMBRE_DIA } from "@/lib/tiempo";
import type { Horario, Tramo } from "@/lib/types";

/** Editor de horario semanal: varios tramos por día (así se marcan las pausas, por ejemplo el almuerzo). */
export function HorarioEditor({ valor, onChange }: { valor: Horario; onChange: (h: Horario) => void }) {
  const poner = (dia: (typeof DIAS)[number], tramos: Tramo[]) => onChange({ ...valor, [dia]: tramos });
  const cambiar = (dia: (typeof DIAS)[number], i: number, pos: 0 | 1, v: string) =>
    poner(dia, valor[dia].map((t, k) => (k === i ? (pos === 0 ? [v, t[1]] : [t[0], v]) : t)) as Tramo[]);
  const copiarLunes = () => onChange({ ...valor, mar: valor.lun, mie: valor.lun, jue: valor.lun, vie: valor.lun });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Horario de trabajo</p>
        <button type="button" onClick={copiarLunes} className="text-sm font-semibold text-brand underline">Copiar el lunes a martes–viernes</button>
      </div>
      {DIAS.map((d) => (
        <div key={d} className="rounded-xl border border-black/10 p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{NOMBRE_DIA[d]}</span>
            {valor[d].length === 0 && <span className="text-sm text-black/50">No trabaja</span>}
          </div>
          <div className="mt-2 space-y-2">
            {valor[d].map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="time" step={900} aria-label={`${NOMBRE_DIA[d]}, desde`} value={t[0]} onChange={(e) => cambiar(d, i, 0, e.target.value)} className="campo !mt-0" />
                <span aria-hidden>–</span>
                <input type="time" step={900} aria-label={`${NOMBRE_DIA[d]}, hasta`} value={t[1]} onChange={(e) => cambiar(d, i, 1, e.target.value)} className="campo !mt-0" />
                <button type="button" aria-label={`Quitar tramo del ${NOMBRE_DIA[d]}`} onClick={() => poner(d, valor[d].filter((_, k) => k !== i))} className="boton-claro !px-3">✕</button>
              </div>
            ))}
            {valor[d].length < 4 && (
              <button type="button" onClick={() => poner(d, [...valor[d], valor[d].length ? ["14:00", "18:00"] : ["09:00", "13:00"]])} className="text-sm font-semibold text-brand underline">
                {valor[d].length ? "+ Agregar otro tramo (pausa en medio)" : "+ Agregar horario"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
