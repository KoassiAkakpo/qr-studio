import { describe, it, expect } from "vitest";
import { describeRejection, formatSize, type RejectedFile } from "./dropzone-messages";

const opts = { maxSize: 2 * 1024 * 1024, acceptLabel: "an image (PNG, JPG)" };

const reject = (...codes: string[]): RejectedFile => ({
  errors: codes.map((code) => ({ code, message: `raw ${code}` })),
});

describe("formatSize", () => {
  it("passe en mégaoctets au-delà du mébioctet", () => {
    expect(formatSize(2 * 1024 * 1024)).toBe("2 MB");
    expect(formatSize(10 * 1024 * 1024)).toBe("10 MB");
  });

  it("garde une décimale sous 10 Mo, aucune au-delà", () => {
    expect(formatSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatSize(12.4 * 1024 * 1024)).toBe("12 MB");
  });

  it("reste en kilooctets en dessous", () => {
    expect(formatSize(500 * 1024)).toBe("500 KB");
  });

  it("n'affiche pas de décimale inutile", () => {
    // toFixed(1) donnerait « 3.0 MB ».
    expect(formatSize(3 * 1024 * 1024)).toBe("3 MB");
  });
});

describe("describeRejection", () => {
  it("nomme les formats attendus pour un mauvais type", () => {
    expect(describeRejection([reject("file-invalid-type")], opts)).toBe(
      "That file is not an image (PNG, JPG)."
    );
  });

  it("cite la limite de taille pour un fichier trop lourd", () => {
    expect(describeRejection([reject("file-too-large")], opts)).toBe(
      "That file is over 2 MB."
    );
  });

  it("demande un fichier unique en cas de surnombre", () => {
    expect(describeRejection([reject("too-many-files")], opts)).toBe("Drop a single file.");
  });

  // Un lot mélangé produirait sinon trois messages ; le format primant, c'est
  // celui qui se corrige en changeant de fichier.
  it("retient le mauvais format quand plusieurs causes se cumulent", () => {
    const mixed = [reject("too-many-files"), reject("file-too-large", "file-invalid-type")];
    expect(describeRejection(mixed, opts)).toBe("That file is not an image (PNG, JPG).");
  });

  it("préfère la taille au surnombre", () => {
    expect(describeRejection([reject("too-many-files"), reject("file-too-large")], opts)).toBe(
      "That file is over 2 MB."
    );
  });

  it("relaie le message de la bibliothèque pour un code inconnu", () => {
    expect(describeRejection([reject("file-too-small")], opts)).toBe("raw file-too-small");
  });

  it("ne rend jamais une chaîne vide", () => {
    expect(describeRejection([], opts)).toBe("That file was rejected.");
    expect(describeRejection([{ errors: [] }], opts)).toBe("That file was rejected.");
  });
});
