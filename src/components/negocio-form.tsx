"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { guardarNegocio } from "@/app/panel/actions-config";
import { FotoInput } from "@/components/foto-input";
import { errorDeSlug } from "@/lib/slug";
import type { Negocio } from "@/lib/types";

export function NegocioForm({ inicial, host }: { inicial: Negocio; host: string }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(inicial.nombre);
  const [slug, setSlug] = useState(inicial.slug);
  const [whatsapp, setWhatsapp] = useState(inicial.whatsapp);
  const [direccion, setDireccion] = useState(inicial.direccion);
  const [logoUrl, setLogoUrl] = useState<string | null>(inicial.logoUrl);
  const r0 = inicial.reglas;
  const [anticipacionH, setAnticipacionH] = useState(String(r0.anticipacionMin / 60));
  const [ventanaDias, setVentanaDias] = useState(String(r0.ventanaDias));
  const [limiteH, setLimiteH] = useState(String(r0.limiteCancelarMin / 60));
  const [intervaloMin, setIntervaloMin] = useState(String(r0.intervaloMin));
  const [margenMin, setMargenMin] = useState(String(r0.margenMin));
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [cargando, setCargando] = useState(false);

  const cambioEnlace = slug !== inicial.slug;
  const motivoEnlace = cambioEnlace ? errorDeSlug(slug) : null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    setOk(false);
    const r = await guardarNegocio({
      nombre, slug, whatsapp, direccion, logoUrl,
      reglas: {
        anticipacionMin: Math.round(Number(anticipacionH) * 60),
        ventanaDias: Number(ventanaDias),
        limiteCancelarMin: Math.round(Number(limiteH) * 60),
        intervaloMin: Number(intervaloMin),
        margenMin: Number(margenMin),
      },
    }).catch(() => ({ ok: false as const, error: "No pudimos conectar. Intenta de nuevo." }));
    setCargando(false);
    if (!r.ok) return setError(r.error);
    setOk(true);
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      <section className="caja space-y-4">
        <h2 className="font-semibold">Tu negocio</h2>
        <FotoInput destino="logo" valor={logoUrl} onChange={setLogoUrl} etiqueta="Logo (opcional)" />
        <label className="block text-sm font-medium">
          Nombre
          <input required maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} className="campo" />
        </label>
        <label className="block text-sm font-medium">
          Enlace para compartir
          <div className="mt-1 flex items-center gap-1 text-sm text-black/60">
            <span className="shrink-0">{host}/</span>
            <input required maxLength={30} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} className="campo !mt-0" />
          </div>
          {motivoEnlace && <span className="mt-1 block text-sm text-red-700">{motivoEnlace}</span>}
          {cambioEnlace && !motivoEnlace && <span className="mt-1 block text-sm text-amber-700">Si cambias el enlace, el anterior deja de funcionar: avisa a tus clientes.</span>}
        </label>
        <label className="block text-sm font-medium">
          WhatsApp del negocio <span className="font-normal text-black/50">(a este número llegan los mensajes de reserva)</span>
          <input type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="300 123 4567" className="campo" />
        </label>
        <label className="block text-sm font-medium">
          Dirección principal <span className="font-normal text-black/50">(opcional)</span>
          <input maxLength={120} value={direccion} onChange={(e) => setDireccion(e.target.value)} className="campo" />
        </label>
      </section>

      <section className="caja space-y-4">
        <h2 className="font-semibold">Reglas de reserva</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Reservar con al menos (horas de anticipación)
            <input type="number" inputMode="decimal" min={0} max={168} step={0.5} value={anticipacionH} onChange={(e) => setAnticipacionH(e.target.value)} className="campo" />
          </label>
          <label className="block text-sm font-medium">
            Reservar hasta (días hacia adelante)
            <input type="number" inputMode="numeric" min={1} max={365} value={ventanaDias} onChange={(e) => setVentanaDias(e.target.value)} className="campo" />
          </label>
          <label className="block text-sm font-medium">
            Cancelar o cambiar hasta (horas antes)
            <input type="number" inputMode="decimal" min={0} max={168} step={0.5} value={limiteH} onChange={(e) => setLimiteH(e.target.value)} className="campo" />
          </label>
          <label className="block text-sm font-medium">
            Una hora disponible cada
            <select value={intervaloMin} onChange={(e) => setIntervaloMin(e.target.value)} className="campo">
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Margen entre citas
            <select value={margenMin} onChange={(e) => setMargenMin(e.target.value)} className="campo">
              {[0, 5, 10, 15, 20, 30].map((m) => <option key={m} value={m}>{m === 0 ? "Sin margen" : `${m} minutos`}</option>)}
            </select>
          </label>
        </div>
      </section>

      {error && <p role="alert" className="aviso-error">{error}</p>}
      {ok && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Cambios guardados.</p>}
      <button type="submit" className="boton w-full" disabled={cargando || !!motivoEnlace}>{cargando ? "Guardando…" : "Guardar cambios"}</button>
    </form>
  );
}
