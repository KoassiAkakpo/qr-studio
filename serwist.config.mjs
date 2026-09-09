// @ts-check
import { existsSync, readFileSync } from "node:fs";
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
    // Les icônes déclarées par convention de fichier (app/icon.svg,
    // app/favicon.ico, app/apple-icon.png) sont émises sous un nom
    // (`static/media/icon.<hash>.svg`) et servies sous un autre
    // (`/icon.svg?icon.<hash>.svg`) : les globs les précachent donc sous une
    // URL que rien ne demande, et hors ligne l'onglet perd son icône.
    //
    // On lit les URLs directement dans le HTML rendu plutôt que de les dériver
    // du chemin de build. Une première version réécrivait les entrées avec une
    // expression rationnelle ancrée sur `distDir` : elle marchait en local et
    // ne matchait pas sur Vercel, ce qui a fait échouer le déploiement. Ici la
    // source est celle que le navigateur suit vraiment, donc les deux ne
    // peuvent plus diverger.
    //
    // `revision: null` parce que ces URLs portent déjà le hash du contenu dans
    // leur query. Le filtre `existsSync` garde le lien avec le disque : une
    // entrée de précache qui répondrait 404 ferait échouer l'installation du
    // worker en entier, donc on n'ajoute que des URLs adossées à une route
    // réellement rendue.
    additionalPrecacheEntries: [
      ...new Set(
        [...readFileSync(`${distDir}server/app/index.html`, "utf8")
          .matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]),
      ),
    ]
      .filter((url) => !url.startsWith("/_next/") && url !== "/manifest.webmanifest")
      .filter((url) => existsSync(`${distDir}server/app${url.split("?")[0]}.body`))
      .map((url) => ({ url, revision: null })),
  };
});
