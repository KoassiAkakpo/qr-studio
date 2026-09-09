// @ts-check
import { generateGlobPatterns, serwist } from "@serwist/next/config";

/**
 * Configuration du service worker, en « configurator mode ».
 *
 * Serwist a deux modes. Le mode webpack (`withSerwistInit` dans next.config)
 * **ne supporte pas Turbopack**, qui est le compilateur par défaut de Next 16 :
 * il faudrait imposer `next build --webpack` et `next dev --webpack` à toute
 * l'app. Ce mode-ci s'exécute à la place *après* le build, lit `.next/` et
 * `public/` pour en dériver le manifeste de précache, puis compile
 * `sw/index.ts` avec esbuild. D'où l'enchaînement dans le script `build` du
 * package.json — `serwist build` seul produirait un manifeste vide ou périmé.
 *
 * `withNextConfig` relit next.config.ts pour en tirer `distDir`, `basePath` et
 * `assetPrefix`, plutôt que de les redéclarer ici où ils dériveraient.
 */
export default serwist.withNextConfig((nextConfig) => {
  // Même normalisation que le preset Serwist : ".next" ou "/.next" -> ".next/".
  let distDir = nextConfig.distDir;
  if (distDir.startsWith("/")) distDir = distDir.slice(1);
  if (!distDir.endsWith("/")) distDir += "/";

  return {
    swSrc: "sw/index.ts",
    // Dans `public/` pour être servi à la racine : un worker à
    // `/_next/static/sw.js` n'aurait autorité que sur `/_next/static/`.
    // Le fichier est généré, donc git-ignoré.
    swDest: "public/sw.js",
    globPatterns: [
      ...generateGlobPatterns(distDir),
      // Les patterns par défaut de Serwist listent js/css/images mais **pas les
      // polices**. Les Geist auto-hébergées par `next/font` atterrissent dans
      // `.next/static/media/*.woff2` et n'étaient donc pas précachées : hors
      // ligne, la page retombait silencieusement sur la pile système, ce que
      // rien à l'écran ne signale. `scripts/check-precache.mjs` le vérifie
      // après chaque build.
      `${distDir}static/**/*.{woff,woff2}`,
    ],
    // Le manifeste est une route d'app, pas un fichier de `public/` : il n'entre
    // dans aucun glob. Le précacher sous l'URL servie, avec une révision
    // dérivée du corps rendu, donc invalidée quand app/manifest.ts change.
    templatedURLs: {
      "/manifest.webmanifest": [`${distDir}server/app/manifest.webmanifest.body`],
    },
    manifestTransforms: [
      (entries) => {
        // Les icônes déclarées par convention de fichier (app/icon.svg,
        // app/favicon.ico, app/apple-icon.png) sont émises dans
        // `static/media/<nom>.<hash>.<ext>` mais servies à
        // `/<nom>.<ext>?<nom>.<hash>.<ext>`. Précachées sous l'URL du build,
        // elles ne répondaient à aucune requête : hors ligne, l'onglet perdait
        // son icône. On les réécrit vers l'URL que le HTML référence vraiment.
        const metadataIcon = new RegExp(
          `^${distDir}static/media/((?:favicon|icon|apple-icon)\\d*)\\.([^/]+)\\.(ico|svg|png)$`,
        );
        const manifest = entries.map((entry) => {
          const match = entry.url.match(metadataIcon);
          if (!match) return entry;
          const [, name, , ext] = match;
          const file = entry.url.slice(entry.url.lastIndexOf("/") + 1);
          return { ...entry, url: `/${name}.${ext}?${file}` };
        });
        return { manifest, warnings: [] };
      },
    ],
  };
});
