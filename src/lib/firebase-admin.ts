import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// El service account va completo en una variable base64 para que pegarla en Vercel no rompa la clave privada.
// Inicialización perezosa: un error de configuración se queda dentro del request, no tumba el arranque.
function getApp() {
  if (getApps().length) return getApps()[0];
  const sa = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ?? "", "base64").toString("utf8") || "{}",
  );
  return initializeApp({
    credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
  });
}

export function getDb() {
  return getFirestore(getApp());
}

export function getAuthAdmin() {
  return getAuth(getApp());
}
