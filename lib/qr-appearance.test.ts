import { describe, it, expect } from "vitest";
import qrcode from "qrcode-generator";
import {
  DEFAULT_APPEARANCE,
  QR_BYTE_CAPACITY,
  captionColorFor,
  captionFontSize,
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
  it("reste proportionnelle à la taille d'export", () => {
    expect(captionFontSize(300)).toBe(14);
    expect(captionFontSize(640)).toBe(30);
    expect(captionFontSize(2048)).toBe(96);
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
