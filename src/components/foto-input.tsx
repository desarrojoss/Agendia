"use client";

import { useState } from "react";
import { firmarSubida } from "@/app/panel/actions-config";

const MAX_MB = 5;

/** Subida de una imagen directo a Cloudinary (firmada por el servidor). Devuelve la URL con onChange. */
export function FotoInput({ destino, valor, onChange, etiqueta, redonda = false }: {
  destino: "logo" | "personal";
  valor: string | null;
  onChange: (url: string | null) => void;
  etiqueta: string;
  redonda?: boolean;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  async function subir(lista: FileList | null) {
    const archivo = lista?.[0];
    if (!archivo) return;
    setError("");
    if (!archivo.type.startsWith("image/")) return setError("Elige una imagen (JPG o PNG).");
    if (archivo.size > MAX_MB * 1024 * 1024) return setError(`La imagen pesa más de ${MAX_MB} MB.`);
    setSubiendo(true);
    try {
      const f = await firmarSubida(destino);
      const fd = new FormData();
      fd.append("file", archivo);
      fd.append("api_key", f.apiKey);
      fd.append("timestamp", String(f.timestamp));
      fd.append("folder", f.folder);
      fd.append("signature", f.signature);
      const r = await fetch(`https://api.cloudinary.com/v1_1/${f.cloudName}/image/upload`, { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "No se pudo subir la imagen.");
      onChange(j.secure_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="text-sm font-medium">
      {etiqueta}
      <div className="mt-1 flex items-center gap-3">
        <div className={`grid size-16 shrink-0 place-items-center overflow-hidden border border-black/15 bg-black/5 text-xs text-black/40 ${redonda ? "rounded-full" : "rounded-xl"}`}>
          {valor ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={valor.replace("/upload/", "/upload/c_fill,w_128,h_128,f_auto,q_auto/")} alt="" className="size-full object-cover" />
          ) : (
            "Sin foto"
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="boton-claro cursor-pointer text-sm">
            {subiendo ? "Subiendo…" : valor ? "Cambiar" : "Subir imagen"}
            <input type="file" accept="image/*" disabled={subiendo} className="sr-only" onChange={(e) => { subir(e.target.files); e.target.value = ""; }} />
          </label>
          {valor && !subiendo && (
            <button type="button" className="boton-claro text-sm" onClick={() => onChange(null)}>Quitar</button>
          )}
        </div>
      </div>
      {error && <p role="alert" className="aviso-error mt-2">{error}</p>}
    </div>
  );
}
