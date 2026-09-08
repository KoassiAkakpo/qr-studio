import { describe, it, expect } from "vitest";
import { dedupeFilenames, slugify } from "./utils";

describe("slugify", () => {
  it("normalise en minuscules et tirets", () => {
    expect(slugify("Emily Turner")).toBe("emily-turner");
    expect(slugify("  Acme, Inc.  ")).toBe("acme-inc");
  });

  it("retombe sur la valeur de repli quand il ne reste rien", () => {
    expect(slugify("")).toBe("qr-code");
    expect(slugify("!!!", "secours")).toBe("secours");
  });

  it("tronque à 60 caractères", () => {
    expect(slugify("a".repeat(200))).toHaveLength(60);
  });
});

describe("dedupeFilenames", () => {
  it("laisse des noms déjà uniques intacts", () => {
    expect(dedupeFilenames(["a.png", "b.png"])).toEqual(["a.png", "b.png"]);
  });

  it("suffixe les doublons avant l'extension", () => {
    expect(dedupeFilenames(["a.png", "a.png", "a.png"])).toEqual([
      "a.png",
      "a-2.png",
      "a-3.png",
    ]);
  });

  it("traite les collisions de casse comme des doublons", () => {
    // macOS et Windows ne distinguent pas A.png de a.png à l'extraction.
    expect(dedupeFilenames(["A.png", "a.png"])).toEqual(["A.png", "a-2.png"]);
  });

  it("évite qu'un nom suffixé n'écrase un nom explicite", () => {
    expect(dedupeFilenames(["a.png", "a.png", "a-2.png"])).toEqual([
      "a.png",
      "a-2.png",
      "a-2-2.png",
    ]);
  });

  it("gère les noms sans extension", () => {
    expect(dedupeFilenames(["contact", "contact"])).toEqual(["contact", "contact-2"]);
  });

  it("préserve l'ordre et la longueur", () => {
    const noms = ["x.png", "y.png", "x.png", "z.png", "y.png"];
    const out = dedupeFilenames(noms);
    expect(out).toHaveLength(noms.length);
    expect(out[3]).toBe("z.png");
  });

  it("ne produit jamais deux noms identiques", () => {
    const noms = Array.from({ length: 200 }, (_, i) => `qr-${i % 7}.png`);
    const out = dedupeFilenames(noms);
    expect(new Set(out.map((n) => n.toLowerCase())).size).toBe(noms.length);
  });
});
