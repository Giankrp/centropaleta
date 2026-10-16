import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: false },
      { source: "/panel.html", destination: "/panel", permanent: false },
      { source: "/cuenta.html", destination: "/cuenta", permanent: false },
      { source: "/identificar-producto.html", destination: "/panel?tab=inventario", permanent: false },
      { source: "/recepcion-ejemplo.html", destination: "/panel?tab=inventario", permanent: false },
      { source: "/seguimiento-ejemplo.html", destination: "/cuenta", permanent: false },
    ];
  },
};

export default nextConfig;
