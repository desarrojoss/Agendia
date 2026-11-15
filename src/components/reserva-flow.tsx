"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { horasPublicas, reservar } from "@/app/actions-reserva";
import type { Resultado } from "@/lib/disponibilidad-datos";
import { DiasYHoras, type Hora } from "@/components/dias-horas";
import { EsperaForm } from "@/components/espera-form";
import { cop, duracion, fechaLarga, horaAmpm, textoAnticipo } from "@/lib/format";
import type { PublicoPersonal, PublicoSede, PublicoServicio } from "@/lib/publico";
import { anticipoDe, MINUTOS_RETENCION } from "@/lib/reservas";

/** Un paso ya resuelto se muestra como una línea con "Cambiar"; el paso activo se muestra abierto. */
function Paso({ n, titulo, resumen, onCambiar, children }: { n: number; titulo: string; resumen?: string; onCambiar?: () => void; children?: React.ReactNode }) {
  return (
    <section className="caja space-y-3">
      <div className="flex items-center gap-3">
        <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${resumen ? "bg-brand text-white" : "border border-brand text-brand"}`}>{resumen ? "✓" : n}</span>
        <h2 className="flex-1 font-semibold">{resumen ?? titulo}</h2>
        {resumen && onCambiar && <button type="button" onClick={onCambiar} className="text-sm font-semibold text-brand underline">Cambiar</button>}
      </div>
      {!resumen && children}
    </section>
  );
}

/** Si el cliente llega desde un aviso de la lista de espera, la página ya trae sede, servicio, día y hora elegidos. */
export type Inicial = { sedeId: string; servicioId: string; fecha: string; res: Resultado; hora: Hora | null };

export function ReservaFlow({ slug, sedes, servicios, personal, hoy, maxFecha, inicial }: { slug: string; sedes: PublicoSede[]; servicios: PublicoServicio[]; personal: PublicoPersonal[]; hoy: string; maxFecha: string; inicial?: Inicial }) {
  const router = useRouter();
  const [sedeId, setSedeId] = useState<string | null>(inicial?.sedeId ?? (sedes.length === 1 ? sedes[0].id : null));
  const [servicioId, setServicioId] = useState<string | null>(inicial?.servicioId ?? null);
  const [staffSel, setStaffSel] = useState<string | null>(inicial ? "cualquiera" : null);
  const [fecha, setFecha] = useState<string | null>(inicial?.fecha ?? null);
  const [hora, setHora] = useState<Hora | null>(inicial?.hora ?? null);
  const [res, setRes] = useState<Resultado | null>(inicial?.res ?? null);
  const [cargandoH, setCargandoH] = useState(false);
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [trampa, setTrampa] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const servicio = servicios.find((s) => s.id === servicioId) ?? null;
  const sede = sedes.find((s) => s.id === sedeId) ?? null;
  const delaSede = servicios.filter((s) => sedeId && s.sedes.includes(sedeId) && personal.some((p) => p.sedeId === sedeId && p.servicios.includes(s.id)));
  const equipo = personal.filter((p) => p.sedeId === sedeId && servicioId && p.servicios.includes(servicioId));
  const staffId = equipo.length === 1 ? equipo[0].id : staffSel;
  const nombreStaff = (id: string) => (res?.ok ? res.personal[id] : undefined) ?? equipo.find((p) => p.id === id)?.nombre ?? "";

  async function cargarHoras(sv: string, sd: string, st: string, fechaDeseada?: string) {
    setCargandoH(true);
    setHora(null);
    let f = fechaDeseada ?? hoy;
    let r = await horasPublicas(slug, { servicioId: sv, sedeId: sd, staffId: st, fecha: f }).catch(() => ({ ok: false as const, error: "No pudimos conectar. Intenta de nuevo." }));
    // si hoy no queda nada, se salta al primer día con cupo
    if (r.ok && !fechaDeseada && r.huecos.length === 0 && r.dias[0] && r.dias[0] !== f) {
      f = r.dias[0];
      r = await horasPublicas(slug, { servicioId: sv, sedeId: sd, staffId: st, fecha: f }).catch(() => r);
    }
    setFecha(f);
    setRes(r);
    setHora(null);
    setCargandoH(false);
  }

  function limpiarDesde(paso: "sede" | "servicio" | "staff" | "hora") {
    if (paso === "sede") { setSedeId(null); setServicioId(null); }
    if (paso === "servicio") setServicioId(null);
    if (paso !== "hora") { setStaffSel(null); setFecha(null); setRes(null); }
    setHora(null);
    setError("");
  }

  function elegirServicio(s: PublicoServicio) {
    setServicioId(s.id);
    setStaffSel(null);
    setHora(null);
    const posibles = personal.filter((p) => p.sedeId === sedeId && p.servicios.includes(s.id));
    if (posibles.length === 1 && sedeId) cargarHoras(s.id, sedeId, posibles[0].id);
  }

  function elegirStaff(id: string) {
    setStaffSel(id);
    if (servicioId && sedeId) cargarHoras(servicioId, sedeId, id);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!servicioId || !sedeId || !staffId || !fecha || !hora) return;
    setEnviando(true);
    setError("");
    const r = await reservar(slug, { servicioId, sedeId, staffId, fecha, hora: hora.hora, cliente: { nombre, whatsapp, email }, trampa }).catch(() => ({ ok: false as const, error: "No pudimos conectar. Intenta de nuevo." }));
    if (r.ok) {
      router.push(`/cita/${r.token}?nueva=1`);
      return;
    }
    setError(r.error);
    setEnviando(false);
    // si la hora se ocupó mientras llenaba sus datos, se refrescan las horas para que elija otra
    if (/disponible|reservada/.test(r.error)) cargarHoras(servicioId, sedeId, staffId, fecha);
  }

  const anticipo = servicio ? anticipoDe({ precio: servicio.precio, anticipo: servicio.anticipo }) : 0;

  return (
    <div className="space-y-4">
      {sedes.length > 1 && (
        <Paso n={1} titulo="¿En qué sede?" resumen={sede ? `Sede: ${sede.nombre}` : undefined} onCambiar={() => limpiarDesde("sede")}>
          <ul className="space-y-2">
            {sedes.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setSedeId(s.id)} className="toque w-full rounded-xl border border-black/15 px-4 py-3 text-left hover:border-brand">
                  <span className="font-semibold">{s.nombre}</span>
                  {s.direccion && <span className="block text-sm text-black/60">{s.direccion}</span>}
                </button>
              </li>
            ))}
          </ul>
        </Paso>
      )}

      {sedeId && (
        <Paso n={sedes.length > 1 ? 2 : 1} titulo="¿Qué servicio quieres?" resumen={servicio ? `${servicio.nombre} · ${duracion(servicio.duracionMin)} · ${servicio.precio ? cop(servicio.precio) : "Gratis"}` : undefined} onCambiar={() => limpiarDesde("servicio")}>
          {delaSede.length === 0 && <p className="text-sm text-black/70">Por ahora no hay servicios para reservar en esta sede.</p>}
          <ul className="space-y-2">
            {delaSede.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => elegirServicio(s)} className="toque w-full rounded-xl border border-black/15 px-4 py-3 text-left hover:border-brand">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{s.nombre}</span>
                    <span className="shrink-0 font-semibold">{s.precio ? cop(s.precio) : "Gratis"}</span>
                  </span>
                  <span className="block text-sm text-black/60">{duracion(s.duracionMin)}{s.descripcion ? ` · ${s.descripcion}` : ""}</span>
                  {s.anticipo.tipo !== "ninguno" && <span className="block text-xs text-amber-700">{textoAnticipo(s.anticipo, s.precio)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </Paso>
      )}

      {servicio && equipo.length > 1 && (
        <Paso n={sedes.length > 1 ? 3 : 2} titulo="¿Con quién?" resumen={staffSel ? (staffSel === "cualquiera" ? "Con cualquiera de nuestro equipo" : `Con ${equipo.find((p) => p.id === staffSel)?.nombre}`) : undefined} onCambiar={() => limpiarDesde("staff")}>
          <ul className="space-y-2">
            <li>
              <button type="button" onClick={() => elegirStaff("cualquiera")} className="toque w-full rounded-xl border border-black/15 px-4 py-3 text-left hover:border-brand">
                <span className="font-semibold">Cualquiera</span>
                <span className="block text-sm text-black/60">Te asignamos a quien esté libre a esa hora</span>
              </button>
            </li>
            {equipo.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => elegirStaff(p.id)} className="toque flex w-full items-center gap-3 rounded-xl border border-black/15 px-4 py-3 text-left hover:border-brand">
                  <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-black/5 font-bold text-black/40">
                    {p.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.fotoUrl.replace("/upload/", "/upload/c_fill,w_80,h_80,f_auto,q_auto/")} alt="" className="size-full object-cover" />
                    ) : (
                      p.nombre[0]
                    )}
                  </span>
                  <span className="font-semibold">{p.nombre}</span>
                </button>
              </li>
            ))}
          </ul>
        </Paso>
      )}

      {servicio && staffId && (
        <Paso n={4} titulo="Elige el día y la hora" resumen={hora && fecha ? `${fechaLarga(fecha)}, ${horaAmpm(hora.hora)}` : undefined} onCambiar={() => limpiarDesde("hora")}>
          {error && <p role="alert" className="aviso-error">{error}</p>}
          <DiasYHoras res={res} fecha={fecha} cargando={cargandoH} onDia={(d) => cargarHoras(servicio.id, sedeId!, staffId, d)} onHora={(h) => { setError(""); setHora(h); }} />
          {res?.ok && <EsperaForm slug={slug} sedeId={sedeId!} servicioId={servicio.id} hoy={hoy} maxFecha={maxFecha} />}
        </Paso>
      )}

      {servicio && staffId && hora && fecha && (
        <form onSubmit={enviar} className="caja space-y-4">
          <h2 className="font-semibold">Tus datos</h2>
          <div className="rounded-xl bg-brand/5 p-3 text-sm">
            <p className="font-semibold">{servicio.nombre} · {servicio.precio ? cop(servicio.precio) : "Gratis"}</p>
            <p>{fechaLarga(fecha)}, {horaAmpm(hora.hora)}</p>
            <p className="text-black/70">Con {staffSel === "cualquiera" || !staffSel ? nombreStaff(hora.asignado) : nombreStaff(staffId)}{sede && sedes.length > 1 ? ` · ${sede.nombre}` : ""}</p>
          </div>
          <label className="block text-sm font-medium">
            Tu nombre
            <input required autoComplete="name" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} className="campo" />
          </label>
          <label className="block text-sm font-medium">
            Tu WhatsApp
            <input required type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="300 123 4567" className="campo" />
          </label>
          <label className="block text-sm font-medium">
            Correo <span className="font-normal text-black/50">(opcional, para recibir el recordatorio)</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="campo" />
          </label>
          {/* campo trampa: una persona no lo ve ni lo llena; los bots sí */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>Web<input tabIndex={-1} autoComplete="off" value={trampa} onChange={(e) => setTrampa(e.target.value)} /></label>
          </div>
          {anticipo > 0 && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Este servicio pide un anticipo de <strong>{cop(anticipo)}</strong>. Tu hora queda retenida {MINUTOS_RETENCION} minutos. El pago en línea se activa en la siguiente entrega de Agendia; mientras tanto, el negocio te confirma por WhatsApp.
            </p>
          )}
          {error && <p role="alert" className="aviso-error">{error}</p>}
          <button type="submit" className="boton w-full" disabled={enviando}>{enviando ? "Reservando…" : "Confirmar reserva"}</button>
        </form>
      )}
    </div>
  );
}
