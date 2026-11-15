import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin/auth depende de jwks-rsa → jose. Si Next lo empaqueta, en Vercel resuelve un jose ESM-only y truena
  // (ERR_REQUIRE_ESM). Como paquete externo se carga desde node_modules con sus dependencias anidadas. (Mismo arreglo que Quotia y Ordenia.)
  serverExternalPackages: ["firebase-admin"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
