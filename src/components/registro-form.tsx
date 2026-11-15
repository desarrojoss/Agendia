"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { registrarNegocio, slugDisponible } from "@/app/actions-auth";
import { errorDeSlug, slugDesde } from "@/lib/slug";

type Estado = { tipo: "vacio" | "revisando" | "libre" | "error"; texto?: string };
type Remoto = { slug: string; libre: boolean; motivo?: string };

export function RegistroForm({ host }: { host: string }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [negocio, setNegocio] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [remoto, setRemoto] = useState<Remoto | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  // El enlace se propone solo a partir del nombre, hasta que la persona lo edite a mano.
  function cambiarNegocio(v: string) {
    setNegocio(v);
    if (!slugEditado) setSlug(slugDesde(v));
  }

  // Revisa en vivo si el enlace está libre (con una pequeña espera para no consultar en cada letra).
  useEffect(() => {
    if (!slug || errorDeSlug(slug)) return;
    const t = setTimeout(async () => {
      const r = await slugDisponible(slug).catch(() => null);
      if (r) setRemoto({ slug, libre: r.libre, motivo: r.motivo });
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  // El estado se deriva: primero la validación local, luego la respuesta del servidor para ESTE enlace.
  const motivoLocal = slug ? errorDeSlug(slug) : null;
  const estado: Estado = !slug
    ? { tipo: "vacio" }
    : motivoLocal
      ? { tipo: "error", texto: motivoLocal }
      : remoto?.slug !== slug
        ? { tipo: "revisando" }
        : remoto.libre
          ? { tipo: "libre" }
          : { tipo: "error", texto: remoto.motivo };

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    const r = await registrarNegocio({ nombre, correo, password, negocio, slug }).catch(() => ({ error: "No pudimos conectar. Intenta de nuevo." }));
    if ("error" in r) {
      setError(r.error);
      setCargando(false);
      return;
    }
    setPassword("");
    setCargando(false);
    router.replace("/panel");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="caja space-y-5">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-wide text-brand">1 · Tu negocio</legend>
        <label className="block text-sm font-medium">
          Nombre de tu negocio
          <input required maxLength={60} value={negocio} onChange={(e) => cambiarNegocio(e.target.value)} placeholder="Barbería Don José" className="campo" />
        </label>
        <label className="block text-sm font-medium">
          Tu enlace para compartir
          <div className="mt-1 flex items-center gap-1 text-sm text-black/60">
            <span className="shrink-0">{host}/</span>
            <input
              required
              value={slug}
              maxLength={30}
              onChange={(e) => {
                setSlugEditado(true);
                setSlug(e.target.value.toLowerCase());
              }}
              placeholder="barberia-don-jose"
              className="campo !mt-0"
              aria-describedby="estado-enlace"
            />
          </div>
          <p id="estado-enlace" className={`mt-1 min-h-5 text-sm ${estado.tipo === "libre" ? "text-brand" : estado.tipo === "error" ? "text-red-700" : "text-black/50"}`}>
            {estado.tipo === "libre" && "✓ Disponible"}
            {estado.tipo === "revisando" && "Revisando…"}
            {estado.tipo === "error" && estado.texto}
          </p>
        </label>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-wide text-brand">2 · Tu cuenta</legend>
        <label className="block text-sm font-medium">
          Tu nombre
          <input required autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} className="campo" />
        </label>
        <label className="block text-sm font-medium">
          Correo
          <input type="email" required autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} className="campo" />
        </label>
        <label className="block text-sm font-medium">
          Contraseña <span className="font-normal text-black/50">(mínimo 8 caracteres)</span>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="campo" />
        </label>
      </fieldset>

      {error && <p role="alert" className="aviso-error">{error}</p>}
      <button type="submit" className="boton w-full" disabled={cargando || estado.tipo === "error" || estado.tipo === "revisando"}>
        {cargando ? "Creando tu agenda…" : "Crear mi agenda gratis"}
      </button>
      <p className="text-center text-sm">
        ¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-brand underline">Inicia sesión</Link>
      </p>
    </form>
  );
}
