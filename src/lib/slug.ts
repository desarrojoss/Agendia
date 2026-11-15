// Enlace público de cada negocio (agendia.../<slug>). Lógica pura: sin dependencias, probada con node --test.

// Rutas de la app que un negocio no puede usar como enlace.
const RESERVADOS = new Set([
  "api", "admin", "panel", "login", "registro", "cita", "demo", "app", "_next", "assets", "static",
  "ayuda", "soporte", "precios", "terminos", "privacidad", "contacto", "blog", "inicio", "logout", "salir",
]);

/** "Barbería  Don José!" → "barberia-don-jose" */
export function slugDesde(texto: string): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

/** Devuelve el motivo por el que no sirve, o null si es válido. */
export function errorDeSlug(slug: string): string | null {
  if (slug.length < 3) return "El enlace debe tener al menos 3 caracteres.";
  if (slug.length > 30) return "El enlace puede tener máximo 30 caracteres.";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return "Usa solo letras minúsculas, números y guiones (sin espacios ni tildes).";
  if (RESERVADOS.has(slug)) return "Ese enlace está reservado. Prueba con otro.";
  return null;
}
