# vendor/

Dépendances installées depuis une archive versionnée plutôt que depuis le
registre npm.

## xlsx-0.20.3.tgz

| | |
|---|---|
| Source | <https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz> |
| sha256 | `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8` |
| Paquet | `xlsx` 0.20.3, Apache-2.0, aucune dépendance |
| Référencé par | `"xlsx": "file:vendor/xlsx-0.20.3.tgz"` dans `package.json` |

### Pourquoi cette archive et pas le registre npm

Le registre npm s'arrête à `xlsx@0.18.5`, qui porte deux avis de sévérité
*high* sans correctif publié :

- [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) —
  prototype pollution, corrigé en 0.19.3
- [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) —
  ReDoS, corrigé en 0.20.2

C'est le code qui parse des tableurs fournis par l'utilisateur, donc rester en
0.18.5 n'était pas tenable. SheetJS ne publie plus sur npm et distribue depuis
son propre registre ; la configuration npm de cet environnement refuse les
archives distantes (`EALLOWREMOTE`), d'où l'archive committée.

L'archive de l'éditeur a été retenue plutôt qu'une republication tierce sur npm
(`@e965/xlsx`) pour ne pas déplacer la confiance vers un intermédiaire.

### Mettre à jour

```bash
V=0.20.4   # vérifier https://cdn.sheetjs.com/ pour la dernière version
curl -sL -o "vendor/xlsx-$V.tgz" "https://cdn.sheetjs.com/xlsx-$V/xlsx-$V.tgz"
shasum -a 256 "vendor/xlsx-$V.tgz"          # reporter la somme dans ce fichier
tar -xzOf "vendor/xlsx-$V.tgz" package/package.json | head -5   # confirmer nom/version
npm uninstall xlsx && npm install "file:vendor/xlsx-$V.tgz"
npm test && npm audit                        # lib/excel.test.ts garde le comportement
git rm "vendor/xlsx-0.20.3.tgz"              # retirer l'ancienne archive
```

`lib/excel.test.ts` fait passer de vrais classeurs par `parseExcelFile` : c'est
ce qui permet de changer de version sans deviner si le comportement a bougé.
