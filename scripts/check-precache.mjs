// Vérifie que le service worker précache bien tout ce dont l'app a besoin hors
// ligne. Tourne en fin de `npm run build`.
//
// Ce contrôle existe parce que les pannes qu'il attrape sont invisibles. Les
// globs par défaut de Serwist omettent les polices : hors ligne la page
// s'affichait en Helvetica, sans rien signaler. Et les icônes de metadata sont
// émises sous un nom (`static/media/icon.<hash>.svg`) et servies sous un autre
// (`/icon.svg?icon.<hash>.svg`), donc précachées sans jamais répondre. Aucune
// des deux ne casse quoi que ce soit de visible au premier coup d'œil, d'où
// l'échec du build plutôt qu'une découverte plus tard.
import { globSync, readFileSync } from "node:fs";

const SW = "public/sw.js";
const HTML = ".next/server/app/index.html";

const sw = readFileSync(SW, "utf8");

/** Une URL est précachée si elle apparaît telle quelle dans le worker. */
const precached = (url) => sw.includes(JSON.stringify(url));

const failures = [];
const report = (label, urls) => {
  const missing = urls.filter((u) => !precached(u));
  if (missing.length > 0) {
    failures.push(`${missing.length} ${label} absent(s) du précache :\n    ${missing.join("\n    ")}`);
  }
  return urls.length;
};

// 1. Le document lui-même : sans lui, un rechargement dur hors ligne ne rend rien.
if (!precached("/")) failures.push('le document racine "/"');

// 2. Tous les fichiers émis par Next que le navigateur ira chercher.
const assets = globSync(".next/static/**/*.{js,css,woff,woff2}");
if (assets.length === 0) {
  failures.push("aucun fichier dans .next/static — le build Next a-t-il tourné avant ?");
}
report(
  "fichier(s) de .next/static",
  assets.map((f) => `/_next/${f.slice(".next/".length)}`),
);

// 3. Tout ce que le HTML rendu référence en même origine. C'est le contrôle
//    général : il porte sur les URLs réellement demandées par la page, pas sur
//    ce que le build a écrit sur le disque, et attrape donc les ressources
//    servies sous une URL différente de leur nom de fichier.
const html = readFileSync(HTML, "utf8");
const referenced = [
  ...new Set([...html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1])),
];
const n = report("ressource(s) référencée(s) par le HTML", referenced);

if (failures.length > 0) {
  console.error(`\n✗ ${SW} est incomplet :\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error("\nVérifiez `globPatterns` et `manifestTransforms` dans serwist.config.mjs.\n");
  process.exit(1);
}

console.log(
  `✓ précache complet : ${assets.length} fichiers de build, ${n} références du HTML, et le document racine.`,
);
