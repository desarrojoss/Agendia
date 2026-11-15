"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { guardarServicio } from "@/app/panel/actions-config";
import type { Con, Sede, Servicio } from "@/lib/types";

export function ServicioForm({ id, inicial, sedes }: { id: string | null; inicial: Servicio | null; sedes: Con<Sede>[] }) {
  const router = useRouter();
  const activas = sedes.filter((s) => s.activo);
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [duracionMin, setDuracionMin] = useState(String(inicial?.duracionMin ?? 30));
  const [precio, setPrecio] = useState(String(inicial?.precio ?? ""));
  const [tipo, setTipo] = useState<"ninguno" | "porcentaje" | "monto">(inicial?.anticipo.tipo ?? "ninguno");
  const [valor, setValor] = useState(inicial && inicial.anticipo.tipo !== "ninguno" ? String(inicial.anticipo.valor) : "");
  const [sel, setSel] = useState<string[]>(inicial?.sedes ?? activas.map((s) => s.id));
  const [activo, setActivo] = useState(inicial?.activo ?? true);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const alternarSede = (sid: string) => setSel((x) => (x.includes(sid) ? x.filter((y) => y !== sid) : [...x, sid]));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    const anticipo = tipo === "ninguno" ? { tipo } : { tipo, valor: Number(valor) };
    const r = await guardarServicio(id, { nombre, descripcion, duracionMin: Number(duracionMin), precio: Number(precio || 0), anticipo, sedes: sel, activo } as Partial<Servicio>).catch(
      () => ({ ok: false as const, error: "No pudimos conectar. Intenta de nuevo." }),
    );
    if (!r.ok) {
      setError(r.error);
      setCargando(false);
      return;
    }
    router.push("/panel/servicios");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="caja space-y-4">
      <label className="block text-sm font-medium">
        Nombre del servicio
        <input required maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Corte de cabello" className="campo" />
      </label>
      <label className="block text-sm font-medium">
        Descripción <span className="font-normal text-black/50">(opcional)</span>
        <input maxLength={200} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="campo" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">
          Duración (minutos)
          <input required type="number" inputMode="numeric" min={5} max={480} step={5} value={duracionMin} onChange={(e) => setDuracionMin(e.target.value)} className="campo" />
        </label>
        <label className="block text-sm font-medium">
          Precio (COP)
          <input required type="number" inputMode="numeric" min={0} step={500} value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="25000" className="campo" />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Anticipo para reservar</legend>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="campo" aria-label="Tipo de anticipo">
          <option value="ninguno">Sin anticipo</option>
          <option value="porcentaje">Un porcentaje del precio</option>
          <option value="monto">Un valor fijo</option>
        </select>
        {tipo !== "ninguno" && (
          <label className="block text-sm font-medium">
            {tipo === "porcentaje" ? "Porcentaje (%)" : "Valor (COP)"}
            <input required type="number" inputMode="numeric" min={1} value={valor} onChange={(e) => setValor(e.target.value)} className="campo" />
          </label>
        )}
        {tipo !== "ninguno" && <p className="text-xs text-black/60">El cliente lo paga al reservar (en esta demo, con tarjeta de prueba). Hasta que pague, la hora queda retenida unos minutos.</p>}
      </fieldset>

      {sedes.length > 1 && (
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Sedes donde se ofrece</legend>
          {activas.map((s) => (
            <label key={s.id} className="toque flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sel.includes(s.id)} onChange={() => alternarSede(s.id)} className="size-5" />
              {s.nombre}
            </label>
          ))}
        </fieldset>
      )}

      <label className="toque flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="size-5" />
        Visible para que los clientes lo reserven
      </label>

      {error && <p role="alert" className="aviso-error">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" className="boton flex-1" disabled={cargando}>{cargando ? "Guardando…" : "Guardar"}</button>
        <Link href="/panel/servicios" className="boton-claro">Cancelar</Link>
      </div>
    </form>
  );
}
