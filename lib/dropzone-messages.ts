/**
 * Traduction des refus de react-dropzone en un message unique.
 *
 * Volontairement séparé du composant : c'est de la logique pure, et l'ordre de
 * précédence des causes est un choix qui mérite d'être verrouillé par des tests.
 */

/**
 * Forme minimale d'un refus, structurellement compatible avec le `FileRejection`
 * de react-dropzone. La déclarer ici évite à `lib/` de dépendre du paquet.
 */
export interface RejectedFile {
  readonly errors: readonly { readonly code: string; readonly message: string }[];
}

export function formatSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1
    ? `${Number(mb.toFixed(mb < 10 ? 1 : 0))} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/**
 * react-dropzone renvoie une liste de fichiers, chacun avec ses propres codes
 * d'erreur ; les afficher tous noierait l'information. On garde la cause la plus
 * actionnable — un mauvais format se corrige en changeant de fichier, un
 * surnombre en déposant moins — et on retombe sur le message de la bibliothèque
 * (anglais, non localisable) uniquement pour un code inattendu.
 */
export function describeRejection(
  rejections: RejectedFile[],
  { maxSize, acceptLabel }: { maxSize: number; acceptLabel: string }
) {
  const codes = new Set(rejections.flatMap((r) => r.errors.map((e) => e.code)));
  if (codes.has("file-invalid-type")) return `That file is not ${acceptLabel}.`;
  if (codes.has("file-too-large")) return `That file is over ${formatSize(maxSize)}.`;
  if (codes.has("too-many-files")) return "Drop a single file.";
  return rejections[0]?.errors[0]?.message ?? "That file was rejected.";
}
