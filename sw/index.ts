/// <reference lib="webworker" />
import { NavigationRoute, Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    /**
     * Remplacé au build par `serwist build` (voir serwist.config.mjs) par la
     * liste des fichiers émis, chacun avec sa révision. C'est la seule façon
     * d'obtenir les noms hachés des chunks `/_next/static/…`, qui n'existent
     * pas encore à l'écriture de ce fichier.
     */
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    // Purge les entrées des builds précédents ; sans ça le stockage grossit à
    // chaque déploiement, chaque chunk haché restant en cache pour toujours.
    cleanupOutdatedCaches: true,
  },
  // Volontairement `false`. Un `skipWaiting` automatique remplace le worker
  // pendant que la page tourne : les chunks déjà chargés et ceux servis ensuite
  // viendraient de deux builds différents. On laisse le nouveau worker en
  // attente, l'indicateur du header le signale, et c'est le clic de
  // l'utilisateur qui déclenche `messageSkipWaiting()` puis le rechargement.
  skipWaiting: false,
  // Nécessaire pour que le nouveau worker prenne la main dès son activation,
  // donc juste avant le rechargement déclenché par l'indicateur.
  clientsClaim: true,
  navigationPreload: false,
  // Aucun `runtimeCaching`. L'app n'émet aucune requête réseau à l'exécution :
  // pas de route API, pas de server action, pas de `fetch`, et les polices Geist
  // sont auto-hébergées par `next/font` au build. Le précache couvre donc la
  // totalité de ce que l'app demande, et une stratégie runtime ne ferait
  // qu'ajouter des caches à expiration qui videraient des fichiers encore
  // nécessaires hors ligne.
  runtimeCaching: [],
  disableDevLogs: true,
});

// Une seule route existe, mais un rechargement dur sur une URL quelconque
// (`/?x=1`, une faute de frappe, une restauration d'onglet) doit rendre l'app
// plutôt que l'écran hors ligne du navigateur. Sert le `/` précaché.
// `NavigationRoute` ne matche que les requêtes de mode `navigate` : le
// manifeste et les chunks ne passent pas par ici.
serwist.registerRoute(new NavigationRoute(serwist.createHandlerBoundToUrl("/")));

serwist.addEventListeners();
