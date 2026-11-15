"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { iniciarSesion } from "@/app/actions-auth";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    const r = await iniciarSesion(email, password).catch(() => ({ error: "No pudimos conectar. Intenta de nuevo." }));
    if ("error" in r) {
      setError(r.error);
      setCargando(false);
      return;
    }
    // Next conserva el estado de las páginas visitadas: se limpia antes de salir del login
    setPassword("");
    setCargando(false);
    router.replace("/panel");
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="caja space-y-4">
      <label className="block text-sm font-medium">
        Correo
        <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="campo" />
      </label>
      <label className="block text-sm font-medium">
        Contraseña
        <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="campo" />
      </label>
      {error && <p role="alert" className="aviso-error">{error}</p>}
      <button type="submit" className="boton w-full" disabled={cargando}>
        {cargando ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-center text-sm">
        ¿Aún no tienes agenda? <Link href="/registro" className="font-semibold text-brand underline">Créala gratis</Link>
      </p>
    </form>
  );
}
