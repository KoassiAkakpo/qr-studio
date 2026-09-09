import { describe, it, expect } from "vitest";
import qrcode from "qrcode-generator";
import {
  appearanceToStylingOptions,
  CORNER_TYPE_LABELS,
  DEFAULT_APPEARANCE,
  DOTS_TYPE_LABELS,
  describeAppearance,
  QR_BYTE_CAPACITY,
  captionColorFor,
  captionFontSize,
  PREVIEW_CAPTION_FONT_SIZE,
  PREVIEW_QR_WIDTH,
  capacityFor,
  contrastRatio,
  exceedsCapacity,
  payloadByteLength,
  readableTextColor,
  scanabilityWarnings,
  type QrAppearance,
} from "./qr-appearance";

const ECLS: QrAppearance["ecl"][] = ["L", "M", "Q", "H"];

describe("payloadByteLength", () => {
  it("compte des octets UTF-8, pas des caractères", () => {
    expect(payloadByteLength("abc")).toBe(3);
    expect(payloadByteLength("é")).toBe(2);
    expect(payloadByteLength("🎉")).toBe(4);
  });
});

describe("QR_BYTE_CAPACITY", () => {
  // Le vrai garde-fou : la table doit correspondre au générateur réellement
  // utilisé, sinon l'avertissement d'UI arriverait trop tôt ou trop tard.
  it.each(ECLS)("accepte un payload à la capacité annoncée (ECL %s)", (ecl) => {
    const qr = qrcode(0, ecl);
    qr.addData("x".repeat(capacityFor(ecl)));
    expect(() => qr.make()).not.toThrow();
  });

  it.each(ECLS)("refuse un octet de plus (ECL %s)", (ecl) => {
    const qr = qrcode(0, ecl);
    qr.addData("x".repeat(capacityFor(ecl) + 1));
    expect(() => qr.make()).toThrow();
  });

  it("décroît quand la correction d'erreur augmente", () => {
    expect(QR_BYTE_CAPACITY.L).toBeGreaterThan(QR_BYTE_CAPACITY.M);
    expect(QR_BYTE_CAPACITY.M).toBeGreaterThan(QR_BYTE_CAPACITY.Q);
    expect(QR_BYTE_CAPACITY.Q).toBeGreaterThan(QR_BYTE_CAPACITY.H);
  });
});

describe("exceedsCapacity", () => {
  it("détecte le dépassement au bon seuil", () => {
    expect(exceedsCapacity("x".repeat(QR_BYTE_CAPACITY.M), "M")).toBe(false);
    expect(exceedsCapacity("x".repeat(QR_BYTE_CAPACITY.M + 1), "M")).toBe(true);
  });

  it("tient compte des caractères multi-octets", () => {
    // 1200 emoji = 4800 octets : au-delà de toutes les capacités.
    const emoji = "🎉".repeat(1200);
    for (const ecl of ECLS) expect(exceedsCapacity(emoji, ecl), ecl).toBe(true);
  });
});

describe("readableTextColor", () => {
  it("choisit du noir sur fond clair et du blanc sur fond sombre", () => {
    expect(readableTextColor("#ffffff")).toBe("#000000");
    expect(readableTextColor("#000000")).toBe("#ffffff");
    expect(readableTextColor("#1a1a2e")).toBe("#ffffff");
    expect(readableTextColor("#fef3c7")).toBe("#000000");
  });

  it("accepte la notation courte", () => {
    expect(readableTextColor("#fff")).toBe("#000000");
    expect(readableTextColor("#000")).toBe("#ffffff");
  });

  it("retombe sur le noir pour une couleur non reconnue", () => {
    expect(readableTextColor("rgb(0,0,0)")).toBe("#000000");
    expect(readableTextColor("")).toBe("#000000");
  });
});

describe("captionColorFor", () => {
  it("suppose un support clair quand le fond est transparent", () => {
    expect(
      captionColorFor({ ...DEFAULT_APPEARANCE, bgColorMode: "transparent", bgColor: "#000000" })
    ).toBe("#000000");
  });

  it("suit la couleur de fond quand elle est opaque", () => {
    expect(
      captionColorFor({ ...DEFAULT_APPEARANCE, bgColorMode: "solid", bgColor: "#111111" })
    ).toBe("#ffffff");
  });
});

describe("captionFontSize", () => {
  // La parité aperçu/export repose sur ce point fixe : à la largeur d'affichage
  // de l'aperçu, la fonction doit rendre exactement la police de l'aperçu.
  it("vaut la police de l'aperçu à la largeur de l'aperçu", () => {
    expect(captionFontSize(PREVIEW_QR_WIDTH)).toBe(PREVIEW_CAPTION_FONT_SIZE);
  });

  it("reste proportionnelle à la taille d'export", () => {
    expect(captionFontSize(640)).toBe(26);
    expect(captionFontSize(2048)).toBe(84);
  });

  it("garde le même rapport à la taille quelle que soit la résolution", () => {
    const ratio = (n: number) => captionFontSize(n) / n;
    expect(ratio(1024)).toBeCloseTo(ratio(PREVIEW_QR_WIDTH), 3);
  });

  it("ne descend jamais sous une taille lisible", () => {
    expect(captionFontSize(16)).toBeGreaterThanOrEqual(10);
  });
});

describe("contrastRatio", () => {
  it("va de 1 (identiques) à 21 (noir sur blanc)", () => {
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 2);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("est symétrique", () => {
    expect(contrastRatio("#6d28d9", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#6d28d9"),
      6
    );
  });
});

describe("scanabilityWarnings", () => {
  it("ne signale rien sur les réglages par défaut", () => {
    expect(scanabilityWarnings(DEFAULT_APPEARANCE)).toEqual([]);
  });

  it("signale un contraste insuffisant", () => {
    const w = scanabilityWarnings({
      ...DEFAULT_APPEARANCE,
      dotsColorMode: "solid",
      dotsColor: "#eeeeee",
      bgColor: "#ffffff",
    });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatch(/Contrast/);
  });

  it("retient la teinte la moins contrastée d'un dégradé", () => {
    // Début très lisible, fin presque invisible : le code reste mauvais.
    const w = scanabilityWarnings({
      ...DEFAULT_APPEARANCE,
      dotsColorMode: "gradient",
      dotsColor: "#000000",
      gradientColor2: "#fafafa",
      bgColor: "#ffffff",
    });
    expect(w.some((m) => /Contrast/.test(m))).toBe(true);
  });

  it("juge le contraste sur du blanc quand le fond est transparent", () => {
    const base = { ...DEFAULT_APPEARANCE, dotsColorMode: "solid" as const, dotsColor: "#f5f5f5" };
    expect(scanabilityWarnings({ ...base, bgColorMode: "transparent", bgColor: "#000000" })).toHaveLength(1);
  });

  it("alerte sur un logo avec une correction d'erreur faible", () => {
    for (const ecl of ["L", "M"] as const) {
      const w = scanabilityWarnings({ ...DEFAULT_APPEARANCE, logoDataUrl: "data:image/png;base64,x", ecl });
      expect(w.some((m) => /logo/.test(m)), ecl).toBe(true);
    }
  });

  it("n'alerte pas sur un logo en correction Q ou H", () => {
    for (const ecl of ["Q", "H"] as const) {
      const w = scanabilityWarnings({ ...DEFAULT_APPEARANCE, logoDataUrl: "data:image/png;base64,x", ecl });
      expect(w, ecl).toEqual([]);
    }
  });

  it("n'alerte pas sur une correction faible sans logo", () => {
    expect(scanabilityWarnings({ ...DEFAULT_APPEARANCE, ecl: "L" })).toEqual([]);
  });
});

describe("appearanceToStylingOptions", () => {
  const sections = ["dotsOptions", "cornersSquareOptions", "cornersDotOptions"] as const;

  // QRCodeStyling.update() fusionne en profondeur : omettre `gradient` laisse en
  // place celui du rendu précédent. La clé doit donc toujours être émise, à
  // undefined en mode solide, sinon repasser en couleur unie reste sans effet.
  it.each(sections)("émet la clé gradient à undefined en mode solide (%s)", (section) => {
    const opts = appearanceToStylingOptions(
      { ...DEFAULT_APPEARANCE, dotsColorMode: "solid", dotsColor: "#123456" },
      "x"
    );
    expect(section in opts).toBe(true);
    expect("gradient" in opts[section]).toBe(true);
    expect(opts[section].gradient).toBeUndefined();
    expect(opts[section].color).toBe("#123456");
  });

  it.each(sections)("pose le dégradé en mode gradient (%s)", (section) => {
    const opts = appearanceToStylingOptions(
      { ...DEFAULT_APPEARANCE, dotsColorMode: "gradient", gradientType: "radial" },
      "x"
    );
    expect(opts[section].gradient).toMatchObject({ type: "radial" });
    expect(opts[section].gradient?.colorStops).toHaveLength(2);
  });

  it("convertit la rotation du dégradé en radians", () => {
    const opts = appearanceToStylingOptions(
      { ...DEFAULT_APPEARANCE, dotsColorMode: "gradient", gradientRotation: 180 },
      "x"
    );
    expect(opts.dotsOptions.gradient?.rotation).toBeCloseTo(Math.PI, 6);
  });

  it("émet toujours la clé image, à undefined sans logo", () => {
    // Même raison que pour le dégradé : sans la clé, retirer un logo le laisserait
    // collé au rendu précédent.
    const opts = appearanceToStylingOptions({ ...DEFAULT_APPEARANCE, logoDataUrl: "" }, "x");
    expect("image" in opts).toBe(true);
    expect(opts.image).toBeUndefined();
  });

  it("reporte le niveau de correction et le fond transparent", () => {
    const opts = appearanceToStylingOptions(
      { ...DEFAULT_APPEARANCE, ecl: "H", bgColorMode: "transparent" },
      "x"
    );
    expect(opts.qrOptions.errorCorrectionLevel).toBe("H");
    expect(opts.backgroundOptions.color).toBe("transparent");
  });
});

describe("DOTS_TYPE_LABELS / CORNER_TYPE_LABELS", () => {
  // Les menus du panneau sont construits depuis ces tables : une entrée vide
  // afficherait une option sans texte plutôt qu'une erreur de compilation.
  it("donnent un libellé non vide à chaque forme", () => {
    for (const [k, v] of Object.entries({ ...DOTS_TYPE_LABELS })) {
      expect(v.trim(), k).not.toBe("");
    }
    for (const [k, v] of Object.entries({ ...CORNER_TYPE_LABELS })) {
      expect(v.trim(), k).not.toBe("");
    }
  });

  it("couvrent exactement les formes acceptées par le rendu", () => {
    expect(Object.keys(DOTS_TYPE_LABELS)).toHaveLength(6);
    expect(Object.keys(CORNER_TYPE_LABELS)).toHaveLength(3);
  });
});

describe("describeAppearance", () => {
  it("nomme la forme, la couleur, la correction et la résolution", () => {
    const d = describeAppearance({
      ...DEFAULT_APPEARANCE,
      dotsColorMode: "solid",
      dotsColor: "#112233",
      dotsType: "square",
      showFrameText: false,
      ecl: "Q",
      size: 1024,
    });
    expect(d).toBe("Square · #112233 · ECL Q · 1024px");
  });

  it("montre les deux bornes d'un dégradé", () => {
    const d = describeAppearance({
      ...DEFAULT_APPEARANCE,
      dotsColorMode: "gradient",
      dotsColor: "#aaaaaa",
      gradientColor2: "#bbbbbb",
    });
    expect(d).toContain("#aaaaaa → #bbbbbb");
  });

  it("signale fond transparent, logo et légende", () => {
    const d = describeAppearance({
      ...DEFAULT_APPEARANCE,
      bgColorMode: "transparent",
      logoDataUrl: "data:image/png;base64,x",
      showFrameText: true,
      frameText: "Scan me",
    });
    expect(d).toContain("transparent bg");
    expect(d).toContain("logo");
    expect(d).toContain("caption");
  });

  it("ne signale pas une légende activée mais vide", () => {
    // La case peut être cochée sur un texte effacé : rien n'est dessiné.
    const d = describeAppearance({
      ...DEFAULT_APPEARANCE,
      showFrameText: true,
      frameText: "   ",
    });
    expect(d).not.toContain("caption");
  });

  it("tient sur une ligne courte", () => {
    expect(describeAppearance(DEFAULT_APPEARANCE).length).toBeLessThan(80);
  });
});
