import { createHash } from "node:crypto";

/** El enlace privado de una cita lleva un token largo y aleatorio; en la base solo se guarda su hash (como una contraseña). */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
