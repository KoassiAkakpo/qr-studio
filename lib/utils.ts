export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Rend une liste de noms de fichiers unique, en suffixant les doublons.
 *
 * JSZip accepte deux entrées homonymes sans broncher : l'archive contient alors
 * deux fichiers de même nom et l'extraction en écrase un. La comparaison est
 * insensible à la casse, parce que macOS et Windows considèrent « A.png » et
 * « a.png » comme le même fichier.
 */
export function dedupeFilenames(names: string[]): string[] {
  const taken = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let candidate = name;
    let n = 1;
    // Le nom suffixé peut à son tour heurter un nom explicite de la liste.
    while (taken.has(candidate.toLowerCase())) {
      n += 1;
      candidate = `${stem}-${n}${ext}`;
    }
    taken.add(candidate.toLowerCase());
    return candidate;
  });
}

export function slugify(s: string, fallback = "qr-code") {
  const slug = s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}
