import { getDb } from "@/lib/firebase-admin";

// Comprueba que el servidor llega a Firestore (escribe y lee un documento). Sin datos sensibles en la respuesta.
export async function GET() {
  try {
    const ref = getDb().collection("_health").doc("ping");
    await ref.set({ ts: Date.now() });
    const ok = (await ref.get()).exists;
    return Response.json({ ok });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
