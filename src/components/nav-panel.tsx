"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/panel", texto: "Resumen", dueno: false },
  { href: "/panel/servicios", texto: "Servicios", dueno: true },
  { href: "/panel/equipo", texto: "Equipo", dueno: true },
  { href: "/panel/sedes", texto: "Sedes", dueno: true },
  { href: "/panel/bloqueos", texto: "Bloqueos", dueno: true },
  { href: "/panel/disponibilidad", texto: "Disponibilidad", dueno: true },
  { href: "/panel/negocio", texto: "Negocio", dueno: true },
];

export function NavPanel({ esDueno }: { esDueno: boolean }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Panel" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2 whitespace-nowrap">
        {ENLACES.filter((e) => esDueno || !e.dueno).map((e) => {
          const activo = e.href === "/panel" ? ruta === "/panel" : ruta.startsWith(e.href);
          return (
            <li key={e.href}>
              <Link href={e.href} aria-current={activo ? "page" : undefined} className={`toque rounded-full px-4 text-sm font-semibold ${activo ? "bg-brand text-white" : "bg-white ring-1 ring-black/10 hover:bg-black/5"}`}>
                {e.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
