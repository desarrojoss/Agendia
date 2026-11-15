import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Revisión rápida y optimista: solo mira que exista la cookie. La verificación real (firma, expiración, que el
// usuario pertenezca a un negocio) la hace requireMember() en cada página y acción del panel.
export const config = { matcher: ["/panel", "/panel/:path*"] };

export function proxy(req: NextRequest) {
  if (!req.cookies.has("session")) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}
