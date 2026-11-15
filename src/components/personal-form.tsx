"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { guardarPersonal } from "@/app/panel/actions-config";
import { FotoInput } from "@/components/foto-input";
import { HorarioEditor } from "@/components/horario-editor";
import type { Con, Horario, Personal, Sede, Servicio } from "@/lib/types";
import { horarioPorDefecto } from "@/lib/validaciones";

export function PersonalForm({ id, inicial, sedes, servicios }: { id: string | null; inicial: Personal | null; sedes: Con<Sede>[]; servicios: Con<Servicio>[] }) {
  const router = useRouter();
  const activas = sedes.filter((s) => s.activo);
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [email, setEmail] = useState(inicial?.email ?? "");
  const [sedeId, setSedeId] = useState(inicial?.sedeId ?? activas[0]?.id ?? "");
  const [sel, setSel] = useState<string[]>(inicial?.servicios ?? []);
  const [fotoUrl, setFotoUrl] = useState<string | null>(inicial?.fotoUrl ?? null);
  const [horario, setHorario] = useState<Horario>(inicial?.horario ?? horarioPorDefecto());
  const [activo, setActivo] = useState(inicial?.activo ?? true);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const alternar = (sid: string) => setSel((x) => (x.includes(sid) ? x.filter((y) => y !== sid) : [...x, sid]));
  const delaSede = servicios.filter((s) => s.sedes.includes(sedeId));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    const r = await guardarPersonal(id, { nombre, email, sedeId, servicios: sel, fotoUrl, horario, activo }).catch(() => ({ ok: false as const, error: "No pudimos conectar. Intenta de nuevo." }));
    if (!r.ok) {
      setError(r.error);
      setCargando(false);
      return;
    }
    router.push("/panel/equipo");
    router.refresh();
  }

  if (!servicios.length)
    return (
      <div className="caja space-y-3">
        <p>Antes de agregar a tu equipo, crea al menos un servicio.</p>
        <Link href="/panel/servicios/nuevo" className="boton">Crear un servicio</Link>
      </div>
    );

  return (
    <form onSubmit={enviar} className="caja space-y-5">
      <FotoInput destino="personal" valor={fotoUrl} onChange={setFotoUrl} etiqueta="Foto (opcional)" redonda />
      <label className="block text-sm font-medium">
        Nombre
        <input required maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Luis Pérez" className="campo" />
      </label>
      <label className="block text-sm font-medium">
        Correo <span className="font-normal text-black/50">(opcional, para darle acceso a su propia agenda)</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="campo" />
      </label>
      {activas.length > 1 && (
        <label className="block text-sm font-medium">
          Sede donde trabaja
          <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} className="campo">
            {activas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
      )}
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Servicios que atiende</legend>
        {delaSede.length === 0 && <p className="text-sm text-black/60">No hay servicios en esta sede. Asígnalos desde el servicio.</p>}
        {delaSede.map((s) => (
          <label key={s.id} className="toque flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sel.includes(s.id)} onChange={() => alternar(s.id)} className="size-5" />
            {s.nombre}
          </label>
        ))}
      </fieldset>
      <HorarioEditor valor={horario} onChange={setHorario} />
      <label className="toque flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="size-5" />
        Recibe reservas
      </label>
      {error && <p role="alert" className="aviso-error">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" className="boton flex-1" disabled={cargando}>{cargando ? "Guardando…" : "Guardar"}</button>
        <Link href="/panel/equipo" className="boton-claro">Cancelar</Link>
      </div>
    </form>
  );
}
