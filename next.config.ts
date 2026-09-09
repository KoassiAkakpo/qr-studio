import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Masque l'indicateur de développement en bas à gauche. Les erreurs de
  // compilation et d'exécution restent affichées.
  devIndicators: false,
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks", "@mantine/dropzone"],
  },
  async headers() {
    return [
      {
        // Le worker est le seul fichier qui ne doit jamais être servi depuis le
        // cache HTTP : c'est en le retéléchargeant que le navigateur découvre
        // qu'un nouveau build existe. S'il est mis en cache, l'app peut rester
        // indéfiniment sur une version périmée sans que l'indicateur du header
        // n'ait jamais l'occasion d'apparaître.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
