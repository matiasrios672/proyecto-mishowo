import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Metadata (título, descripción, og:*) bloqueante para TODOS los clientes: los links de los negocios se
  // comparten por WhatsApp, Instagram, iMessage, etc., y hay demasiados scrapers para listarlos uno por uno.
  // La metadata sale de datos cacheados (getSite), así que el costo en velocidad es mínimo.
  htmlLimitedBots: /.*/,
  cacheComponents: true,
  partialPrefetching: true,
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
