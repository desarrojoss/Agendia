"use client";

import { useState } from "react";

export function CopiarEnlace({ url, whatsappTexto }: { url: string; whatsappTexto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="boton-claro"
        onClick={async () => {
          await navigator.clipboard.writeText(url).catch(() => null);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        }}
      >
        {copiado ? "¡Copiado!" : "Copiar enlace"}
      </button>
      <a className="boton-claro" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(whatsappTexto)}`}>Compartir por WhatsApp</a>
    </div>
  );
}
