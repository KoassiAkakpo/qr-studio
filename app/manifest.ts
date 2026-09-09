import type { MetadataRoute } from "next";

/**
 * Convention de fichier Next : sert `/manifest.webmanifest` et l'annonce dans
 * `<head>`. Ne pas déposer un `manifest.json` dans `public/`, les deux se
 * concurrenceraient.
 *
 * L'app ne fait aucun appel réseau à l'exécution — tout le rendu QR, le parsing
 * xlsx et le ZIP tournent dans le navigateur — donc une fois le shell précaché
 * elle est complète hors ligne, pas dégradée.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QR Studio — Custom QR Code Generator",
    short_name: "QR Studio",
    description:
      "Generate single or batch QR codes with custom colors, gradients, logos and PNG/ZIP export. Works offline.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    // Le fond d'écran de démarrage ne suit pas le thème système : il est peint
    // avant que la page ne s'exécute, donc `prefers-color-scheme` n'est pas
    // consultable. Blanc, comme le premier rendu de Mantine en clair.
    background_color: "#ffffff",
    theme_color: "#228be6",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Séparée de la variante « any » : une icône déclarée maskable est rognée
      // jusqu'à 20 % par la plateforme, ce qui mangerait les coins du motif.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
