import type { NextConfig } from "next";

const POLITICA_SEGURIDAD: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src https://maps.google.com https://www.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: Object.entries(POLITICA_SEGURIDAD).map(([key, value]) => ({ key, value })),
      },
    ];
  },
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: false },
      { source: "/panel.html", destination: "/panel", permanent: false },
      { source: "/cuenta.html", destination: "/cuenta", permanent: false },
      {
        source: "/identificar-producto.html",
        destination: "/panel?tab=inventario",
        permanent: false,
      },
      { source: "/recepcion-ejemplo.html", destination: "/panel?tab=inventario", permanent: false },
      { source: "/seguimiento-ejemplo.html", destination: "/cuenta", permanent: false },
    ];
  },
};

export default nextConfig;
