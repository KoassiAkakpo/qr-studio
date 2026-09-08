# QR Studio — Audit et plan de correction

Audit réalisé le 2026-09-08 sur `main` (commit `0cea93a`). Chaque problème marqué
**[vérifié]** a été reproduit empiriquement, pas seulement déduit de la lecture.

Ordre de traitement : les lots 1 à 3 changent ce que le produit livre réellement
à ses utilisateurs et passent en premier.

---

## P0 — Bugs qui cassent le produit

### ✅ 1. Le caption n'est jamais dans le PNG exporté **[vérifié]**

`frameText` n'apparaît que dans `components/qr-studio/qr-preview.tsx` (rendu React) ;
`renderQrPngBlob` et `appearanceToStylingOptions` l'ignorent totalement. Comme
`showFrameText: true` par défaut avec « Scan for details », **tout utilisateur voit
un aperçu qui ne correspond pas à son export.**

### ✅ 2. Dépassement de capacité → page blanche **[vérifié]**

`qrcode-generator` lève `code length overflow (19220>18672)` dès ~2 400 caractères
en ECL M. Le `.update()` dans le `useEffect` de `QrPreview` n'est pas protégé et il
n'existe aucune error boundary → l'arbre React casse. Le hint « ~2,900 chars » de
`QR_TYPE_META.text` n'est vrai qu'en ECL L.

### ✅ 3. VEVENT corrompu par une virgule ou un retour ligne **[vérifié — corrigé au lot 1]**

Aucune valeur texte iCalendar n'est échappée. Payload réellement produit avec une
description multi-lignes :

```text
DESCRIPTION:Venez
nombreux, svp      <- ligne orpheline, l'événement est invalide
```

S'ajoutent : pas d'enveloppe `VCALENDAR`, `UID` et `DTSTAMP` absents (requis par la
RFC 5545 §3.6.1).

### ✅ 4. vCard : champs qui s'écrasent **[vérifié]**

Payload réellement produit avec tous les champs remplis :

```text
TITLE:Dr.          <- civilité
TITLE:Lead UX      <- poste : deux TITLE, le parseur en garde un au hasard
NOTE:Dept: Design
NOTE:Rencontre...  <- le département détruit la note
```

`title` (civilité) doit aller dans le 4e composant de `N:` (prefix),
`department` dans le 2e composant de `ORG:`.

### ✅ 5. mailto : espaces encodés en `+` **[vérifié]**

`URLSearchParams` produit `subject=Hello+there`. Les clients mail n'interprètent pas
`+` comme un espace dans un mailto → « Hello+there » s'affiche littéralement.
Il faut `encodeURIComponent`.

### ✅ 6. Import Excel calendrier : dates silencieusement perdues **[vérifié]**

Testé sur un vrai `.xlsx` : sans `cellDates: true`, `lib/excel.ts` reçoit
`start: 46296.74` (série Excel) → `new Date("46296.74")` → `Invalid Date` →
`toVEventDate` renvoie `null` → `DTSTART`/`DTEND` omis sans aucun message.
**Tout batch calendrier produit des événements sans date.**

À traiter aussi : le flottant Excel donne `17:59:59.999` pour 18:00, et
`toVEventDate` tronque les secondes → 17:59. Arrondir à la minute.

---

## P1 — Fonctionnalités inaccessibles, données perdues

| #  | Problème |
|----|----------|
| 7  | `gradientType` (radial) et `logoSizeRatio` existent dans le type et les defaults mais **aucun contrôle UI** ; le label dit « Linear gradient » en dur |
| 8  | ✅ Collisions de noms dans le ZIP : deux lignes homonymes → entrées dupliquées, écrasement à l'extraction |
| 9  | ✅ `parseExcelFile` ne normalise que le trim, pas la casse → `FirstName` ≠ `firstName` → ligne invalide en silence |
| 10 | ✅ Le template `person` omet `title`, `nickname`, `department`, `address`, `note`, `phoneOther` que `rowToFormData` lit pourtant |
| 11 | ✅ Zéro validation : lat/lng non numériques donnent `geo:abc,def` ; email jamais vérifié |

---

## P2 — Sécurité

### ✅ 12. `xlsx@0.18.5` : 2 CVE high, sans correctif sur npm **[vérifié via npm audit]**

Prototype pollution ([GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6))
et ReDoS ([GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9)),
avec *« No fix available »* — alors que c'est précisément le code qui parse des
fichiers fournis par l'utilisateur. SheetJS a quitté npm : passer au registre
officiel (`https://cdn.sheetjs.com/xlsx-0.20.x`) ou basculer sur `exceljs`.

---

## P3 — Dark mode et accessibilité

| #  | Problème |
|----|----------|
| 13 | ✅ Le header code en dur `rgba(255,255,255,0.9)` et le caption utilise `c="black"` → illisibles en dark. `ColorSchemeScript` est posé mais aucun toggle n'existe : dark mode à moitié câblé |
| 14 | ✅ Deux `ActionIcon` décoratifs avec `pointerEvents: "none"` → des `<button>` focusables au clavier mais inertes |
| 15 | ✅ Les `ColorInput` et le `NumberInput` de rotation n'ont aucun label |

### ✅ 33. Échec d'hydratation quand un thème sombre est stocké **[découvert au lot 5]**

Non repéré à l'audit initial, qui n'avait pas fait tourner l'app dans un navigateur.
`useComputedColorScheme` renvoie la valeur stockée dès le premier rendu client —
`getInitialValueInEffect` ne diffère que la media query, pas `localStorage` — donc
tout embranchement JSX sur le schéma fait diverger serveur et client. React
régénérait alors tout l'arbre côté client (erreur #418), en production comme en dev.

Le cas ne se manifeste **que** lorsqu'un thème explicite « dark » est stocké : un
profil neuf ne le reproduit pas.

---

## P4 — Qualité et maintenabilité

| #  | Problème |
|----|----------|
| 16 | ✅ **Aucun test**, alors que `buildQrPayload` et `rowToFormData` sont des fonctions pures — la cible idéale, et précisément là où se nichent les bugs 3/4/5 |
| 17 | Métadonnées par type éclatées sur 3 fichiers (`QR_TYPE_META`, `TYPE_ORDER`, `TYPE_ICONS`) → un registre unique supprimerait la synchronisation manuelle |
| 18 | ✅ Les casts `as unknown as` de `renderQrPngBlob` sont **inutiles** : `DrawType = "canvas" \| "svg"` et `getRawData` sont correctement typés. La note CLAUDE.md qui les dit « load-bearing » est fausse |
| 19 | `handleDownload` réimplémente `slugify` inline |
| 20 | Branche `r.filename` morte dans `labelForRow` (`QrFormData` n'a pas ce champ) |
| 21 | Nouvel objet `appearance` à chaque render du batch → `.update()` sur les 12 aperçus à chaque frappe |
| 22 | Pas de cleanup dans `QrPreview` → instances `QRCodeStyling` jamais libérées |
| 23 | `{...appearance, size: appearance.size}` : no-op |
| 24 | `BatchRow.raw` jamais lu |
| 25 | `Select` du batch affiche les clés brutes (`url`, `person`) au lieu des labels |
| 26 | `alert()` au lieu de notifications Mantine |
| 27 | Breakpoint 1024px en `<style>` inline, désaccordé des breakpoints Mantine |
| 28 | Logo sans validation taille/type ni gestion d'erreur `FileReader` |
| 29 | Aucun avertissement logo + ECL faible, aucun contrôle de contraste (blanc sur blanc possible) |
| 30 | README encore le boilerplate create-next-app |
| 31 | ✅ Batch 500 lignes séquentiel sans annulation ni barre de progression |
| 32 | ✅ `error` réutilisé pour les warnings → alerte rouge « Note » sur un import réussi |

---

## Lots de correction

### ✅ Lot 1 — Encodages + filet de sécurité tests  ·  #3, #4, #5, #6, #16 (+ #9, #11 partiel)

**Fait.** 33 tests dans `lib/qr-payloads.test.ts` ; les 12 qui échouaient au départ
documentaient exactement les bugs #3, #4, #5, #6, #9 et #11.

`#9` (casse des colonnes) et la partie lat/lng de `#11` étaient initialement prévus
au lot 4, mais touchaient les mêmes fonctions et étaient déjà couverts par la suite
de tests — les repousser aurait laissé des tests rouges dans l'arbre. La validation
de l'email reste au lot 4, au niveau du formulaire.

`@types/node` est passé de `^20` à `^26` (aligné sur le runtime) : Vitest 5 exige ≥22.

Corrections livrées :

- `escapeText` unifié pour vCard et iCalendar (backslash, `;`, `,`, retours ligne
  → `\n`), et `structured()` pour les valeurs composées, qui échappe chaque
  composant sans toucher aux `;` séparateurs
- enveloppe `VCALENDAR` + `VERSION:2.0` + `PRODID`, avec `UID` (`stableHash` du
  contenu) et `DTSTAMP` (dérivé de la date de début) **déterministes** — pas de
  `Date.now()`, `buildQrPayload` tourne dans un `useMemo` et doit rester pure
- vCard : `N:` à 5 composants avec la civilité en prefix, un seul `TITLE` (le poste),
  `ORG:organization;department`, un seul `NOTE`
- `encodeURIComponent` pour mailto, à la place d'`URLSearchParams`
- `escapeWifi` couvre désormais le guillemet
- `cellDates: true` + `toDateTimeLocal` avec arrondi à la minute
- lookup de colonnes insensible à la casse, rejet des lat/lng non numériques

Les tests ont été écrits avant les correctifs, parce que ce sont des changements de
format de sortie où une régression est invisible à l'œil nu.

### ✅ Lot 2 — Robustesse du rendu  ·  #1, #2 (+ #18)

**Fait.** 19 tests supplémentaires (52 au total).

- La légende est composée sur un canvas 2D par-dessus le PNG du QR.
  `captionColorFor` et `captionFontSize` sont partagés entre l'aperçu et l'export
  pour qu'ils ne puissent plus diverger ; la couleur du texte suit désormais la
  luminance du fond (WCAG) au lieu d'un noir codé en dur.
- Capacité vérifiée **avant** génération via une table version 40 par niveau ECL,
  validée dans les tests contre le vrai générateur (accepte la capacité annoncée,
  refuse un octet de plus). Elle alimente le badge d'octets, l'alerte, et
  désactive les actions qui produisent une image.
- Le `try`/`catch` autour de `.update()` reste un filet pour les erreurs
  imprévues ; l'échec est indexé par signature `payload|ecl` pour se périmer au
  rendu sans second `setState`.
- Les casts `as unknown as` de `renderQrPngBlob` sont supprimés (#18).

Vérifié dans Chrome headless via CDP, en interceptant le blob réellement produit
par l'app : 640×706 avec 2331 pixels d'encre dans la bande de légende, et un
`inkQR` identique (172245) avec et sans légende — le QR n'est pas dégradé. Côté
capacité : à 2 400 caractères en ECL M, l'alerte s'affiche, les boutons se
désactivent, la page survit, aucune exception non capturée, et le QR revient
quand on repasse sous la limite.

Cette vérification navigateur a trouvé un bug que les tests unitaires ne
pouvaient pas voir : `ImageBitmap.close()` remet `width`/`height` à 0, et la
première version lisait `bitmap.height` après la fermeture — la légende était
dessinée par-dessus le QR.

### ✅ Lot 3 — Sécurité  ·  #12

**Fait.** `npm audit` passe de 1 vulnérabilité *high* (2 avis) à **0**.

`xlsx` 0.18.5 → 0.20.3 : la prototype pollution est corrigée en 0.19.3, la ReDoS
en 0.20.2. Le registre npm s'arrête à 0.18.5, SheetJS ne publiant plus dessus.

La configuration npm de cet environnement refuse les archives distantes
(`EALLOWREMOTE`), donc l'archive officielle est **committée dans `vendor/`** et
référencée par `"xlsx": "file:vendor/xlsx-0.20.3.tgz"`. L'archive de l'éditeur a
été préférée à une republication tierce sur npm (`@e965/xlsx`) pour ne pas
déplacer la confiance vers un intermédiaire. Provenance, sha256 et procédure de
mise à jour dans `vendor/README.md`.

`lib/excel.test.ts` (10 tests) a été écrit **avant** la migration et exécuté sur
0.18.5 pour capturer le comportement de référence : il fait passer de vrais
classeurs par `parseExcelFile`. Les 62 tests passent à l'identique après
migration, ce qui prouve l'absence de changement de comportement plutôt que de
le supposer.

Vérifications supplémentaires : `npm ci` depuis un `node_modules` vide restitue
bien 0.20.3 (le vrai risque d'une dépendance `file:`), et `XLSX.writeFile` —
seule API non couverte par les tests car navigateur uniquement — produit dans
Chrome un blob de 17 054 octets dont l'en-tête `50 4b 03 04` confirme un xlsx
valide.

Coût assumé : 2,3 Mo de binaire versionné dans le dépôt.

### ✅ Lot 4 — Batch fiable  ·  #8, #10, #11, #31, #32

**Fait.** 24 tests supplémentaires (86 au total). #9 avait été traité au lot 1.

- `dedupeFilenames` suffixe les doublons avant l'extension, en comparant sans
  tenir compte de la casse (macOS et Windows confondent `A.png` et `a.png`) et
  en évitant qu'un nom suffixé n'écrase un nom explicite de la liste. La
  déduplication ne porte que sur les lignes réellement exportées.
- Template `person` complété des six colonnes que `rowToFormData` lisait sans
  qu'elles soient atteignables. Un test d'invariant compare, pour chaque type,
  les colonnes du template aux champs du type — la dérive ne peut plus revenir.
- `isLikelyEmail` rejette les adresses malformées à l'import, et une adresse
  invalide ne suffit plus à identifier un contact. Le formulaire affiche l'erreur
  sous le champ en saisie directe.
- `Progress` Mantine avec compteur et bouton d'annulation ; le drapeau vit dans
  un `ref` pour que la boucle en cours le voie immédiatement.
- `warning` (jaune, l'opération a réussi avec réserves) séparé d'`error`
  (rouge, l'opération a échoué).

Vérifié dans Chrome via CDP, avec de vrais classeurs téléversés par
`DOM.setFileInputFiles` :

| Cas | Résultat |
|---|---|
| 3 lignes réclamant le même nom, dont une en casse différente | `same.png`, `same-2.png`, `same-3.png` |
| Ligne vide + ligne dont la seule identité est `pas-une-adresse` | 3 valides / 2 invalides, signalées en jaune |
| 505 lignes | 500 valides, avertissement de troncature, aucune erreur rouge |
| Annulation en cours d'export | barre à « 5 / 40 rendered », puis UI réinitialisée et **aucun ZIP produit** |

### ✅ Lot 5 — Dark mode + a11y  ·  #13, #14, #15 (+ #33)

**Fait.** Aucun test unitaire ajouté : ces défauts ne vivent que dans le rendu
navigateur, où ils ont été vérifiés.

- Couleurs de l'habillage issues des tokens sémantiques (`--mantine-color-body`,
  `--mantine-color-default-border`, `--mantine-color-default-hover`). L'en-tête
  collant garde sa translucidité via `color-mix()` tout en suivant le schéma.
- Schéma en `auto` par défaut (suit l'OS) et bouton de bascule dans l'en-tête,
  persisté par Mantine.
- `ThemeIcon` remplace les `ActionIcon` décoratifs rendus inertes par
  `pointerEvents: "none"`, qui restaient focusables au clavier.
- Labels visibles sur les entrées couleur et la rotation ; `aria-label` sur les
  14 champs de la fiche contact, qui n'ont qu'un placeholder par choix de design.

Mesures dans Chrome :

| | clair | sombre |
|---|---|---|
| Fond effectif de l'en-tête | `[255,255,255]` | `[36,36,36]` |
| Contraste titre / en-tête | 21 | 9,37 |
| Contraste corps / fond | 21 | 9,37 |

(AA exige 4,5.) Boutons focusables mais inertes : **0**. Champs sans nom
accessible : **0** — le seul restant est l'`input[type=file]` natif que Mantine
masque en `display:none`, hors de l'arbre d'accessibilité. Les 5 boutons sans
libellé sont des internes Mantine (pipettes `ColorInput`, chevrons `NumberInput`).

Hydratation vérifiée en **build de production** sur les quatre états de stockage
(aucun / `dark` / `light` / `auto`) : 0 erreur dans chacun. La console de dev est
également passée de 2 messages à 0.

### Lot 6 — Nettoyage  ·  #7, #17 à #30

Registre de types unifié, exposition de `gradientType` / `logoSizeRatio`, suppression
des casts et du code mort, mémoïsation du batch, cleanup `QrPreview`, notifications,
README, correction de CLAUDE.md.
