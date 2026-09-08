import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Masque l'indicateur de développement en bas à gauche. Les erreurs de
  // compilation et d'exécution restent affichées.
  devIndicators: false,
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
  },
};

export default nextConfig;
