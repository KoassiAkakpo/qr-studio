"use client";

import { SerwistProvider } from "@serwist/next/react";
import type { ReactNode } from "react";

/**
 * Enregistre le service worker et expose son instance via `useSerwist()`, dont
 * dépend [UpdateButton](./update-button.tsx).
 *
 * Le worker n'existe qu'après `serwist build`, qui ne tourne que dans
 * `npm run build` : en dev il n'y a pas de `/sw.js` à enregistrer, et un worker
 * qui précacherait les chunks de dev servirait du code périmé à chaque
 * rechargement. On le désactive donc explicitement.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV !== "production"}
      // Défaut `true`, et c'est un piège ici : il recharge la page dès que le
      // navigateur repasse en ligne. Tout l'état de l'app est en mémoire — une
      // fiche contact à moitié saisie, un tableur importé, une apparence
      // réglée —, donc un rechargement spontané le perd. Rien n'a besoin du
      // réseau de toute façon.
      reloadOnOnline={false}
      // Une seule route : il n'y a aucune navigation dont mettre l'URL en cache.
      cacheOnNavigation={false}
    >
      {children}
    </SerwistProvider>
  );
}
