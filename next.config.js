/** @type {import('next').NextConfig} */
const cabeceras = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: cabeceras },
      // Los datos de la API cambian en cada operación: nunca se guardan en caché. Las fotos (por id, no cambian) sí las cachea el navegador.
      { source: "/api/((?!fotos).*)", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/:file(logo-venu\\.(?:png|webp)|icon\\.png)", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
};

module.exports = nextConfig;
