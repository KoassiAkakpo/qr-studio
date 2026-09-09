export type DotsType =
  | "square"
  | "rounded"
  | "dots"
  | "classy"
  | "classy-rounded"
  | "extra-rounded";

export type CornerType = "square" | "dot" | "extra-rounded";

export interface QrAppearance {
  dotsType: DotsType;
  cornersSquareType: CornerType;
  cornersDotType: CornerType;
  dotsColorMode: "solid" | "gradient";
  dotsColor: string;
  gradientColor2: string;
  gradientType: "linear" | "radial";
  gradientRotation: number;
  bgColorMode: "solid" | "transparent";
  bgColor: string;
  margin: number;
  size: number;
  ecl: "L" | "M" | "Q" | "H";
  logoDataUrl: string;
  logoSizeRatio: number;
  frameText: string;
  showFrameText: boolean;
}

/**
 * Libellés des formes, ici et non dans le composant : le résumé d'apparence du
 * mode lot les réutilise, et deux tables séparées finiraient par diverger.
 * `Record<DotsType, string>` force TypeScript à réclamer une entrée pour toute
 * forme ajoutée.
 */
export const DOTS_TYPE_LABELS: Record<DotsType, string> = {
  square: "Square",
  rounded: "Rounded",
  dots: "Dots",
  classy: "Classy",
  "classy-rounded": "Classy rounded",
  "extra-rounded": "Extra rounded",
};

export const CORNER_TYPE_LABELS: Record<CornerType, string> = {
  square: "Square",
  dot: "Dot",
  "extra-rounded": "Rounded",
};

export const DEFAULT_APPEARANCE: QrAppearance = {
  dotsType: "extra-rounded",
  cornersSquareType: "extra-rounded",
  cornersDotType: "dot",
  dotsColorMode: "gradient",
  dotsColor: "#6d28d9",
  gradientColor2: "#ec4899",
  gradientType: "linear",
  gradientRotation: 171,
  bgColorMode: "solid",
  bgColor: "#ffffff",
  margin: 12,
  size: 640,
  ecl: "M",
  logoDataUrl: "",
  logoSizeRatio: 0.22,
  frameText: "Scan for details",
  showFrameText: true,
};

/**
 * Capacité maximale en octets d'un QR version 40, par niveau de correction
 * d'erreur (mode octet). Au-delà, le générateur lève « code length overflow ».
 * Le logo n'entre pas en compte : il recouvre des modules mais ne consomme pas
 * de capacité de données.
 */
export const QR_BYTE_CAPACITY: Record<QrAppearance["ecl"], number> = {
  L: 2953,
  M: 2331,
  Q: 1663,
  H: 1273,
};

/** Le payload est encodé en UTF-8 : c'est la taille en octets qui compte, pas en caractères. */
export function payloadByteLength(payload: string) {
  return new TextEncoder().encode(payload).length;
}

export function capacityFor(ecl: QrAppearance["ecl"]) {
  return QR_BYTE_CAPACITY[ecl];
}

export function exceedsCapacity(payload: string, ecl: QrAppearance["ecl"]) {
  return payloadByteLength(payload) > capacityFor(ecl);
}

function parseHexColor(color: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const h = m[1];
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Noir ou blanc selon la luminance du fond (WCAG). Le seuil 0.179 est le point
 * où les contrastes avec le noir et avec le blanc s'égalisent.
 *
 * Utilisé à l'identique dans l'aperçu et dans l'export : c'est ce qui garantit
 * que la légende a la même couleur des deux côtés.
 */
export function readableTextColor(background: string): string {
  const rgb = parseHexColor(background);
  if (!rgb) return "#000000";
  const [r, g, b] = rgb.map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

function relativeLuminance(rgb: [number, number, number]) {
  const [r, g, b] = rgb.map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG entre deux couleurs hex, de 1 (identiques) à 21. */
export function contrastRatio(a: string, b: string): number {
  const ca = parseHexColor(a);
  const cb = parseHexColor(b);
  if (!ca || !cb) return 1;
  const [hi, lo] = [relativeLuminance(ca), relativeLuminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** En dessous, les lecteurs peinent à séparer les modules du fond. */
export const MIN_SCAN_CONTRAST = 3;

/**
 * Réglages qui produisent un code peu lisible. Purement consultatif : rien n'est
 * bloqué, mais l'utilisateur ne découvre plus le problème en scannant.
 */
export function scanabilityWarnings(appearance: QrAppearance): string[] {
  const warnings: string[] = [];
  const background =
    appearance.bgColorMode === "transparent" ? "#ffffff" : appearance.bgColor;

  // En dégradé, c'est la teinte la moins contrastée qui décide.
  const foregrounds =
    appearance.dotsColorMode === "gradient"
      ? [appearance.dotsColor, appearance.gradientColor2]
      : [appearance.dotsColor];
  const worst = Math.min(...foregrounds.map((c) => contrastRatio(c, background)));
  if (worst < MIN_SCAN_CONTRAST) {
    warnings.push(
      `Contrast between the pixels and the background is ${worst.toFixed(1)}:1. ` +
        `Below ${MIN_SCAN_CONTRAST}:1 many scanners fail — darken the pixels or lighten the background.`
    );
  }

  // Un logo masque des modules ; seule la redondance de la correction d'erreur
  // permet de les reconstituer.
  if (appearance.logoDataUrl && (appearance.ecl === "L" || appearance.ecl === "M")) {
    warnings.push(
      `A centre logo hides part of the code. At error correction ${appearance.ecl} there ` +
        `may not be enough redundancy to recover it — Q or H is safer.`
    );
  }

  return warnings;
}

/** Couleur de la légende : sur fond transparent, on suppose un support clair. */
export function captionColorFor(appearance: QrAppearance) {
  return readableTextColor(
    appearance.bgColorMode === "transparent" ? "#ffffff" : appearance.bgColor
  );
}

/**
 * Largeur d'affichage du QR dans l'aperçu, en pixels CSS.
 *
 * Vit ici et non dans le composant parce que `captionFontSize` en dépend :
 * c'est la référence qui garantit que la légende exportée a la même taille
 * relative que celle de l'aperçu. Changer l'une sans l'autre casse la parité.
 */
export const PREVIEW_QR_WIDTH = 340;

/** Taille de la légende dans l'aperçu, en pixels CSS (Mantine `size="sm"`). */
export const PREVIEW_CAPTION_FONT_SIZE = 14;

/**
 * Taille de police de la légende, proportionnelle au QR.
 *
 * Le ratio reproduit l'aperçu : l'export reste visuellement identique quelle que
 * soit la résolution choisie.
 */
export function captionFontSize(qrSize: number) {
  return Math.max(
    10,
    Math.round(qrSize * (PREVIEW_CAPTION_FONT_SIZE / PREVIEW_QR_WIDTH))
  );
}

export function appearanceToStylingOptions(
  appearance: QrAppearance,
  data: string
) {
  const gradient =
    appearance.dotsColorMode === "gradient"
      ? {
          type: appearance.gradientType,
          rotation: (appearance.gradientRotation * Math.PI) / 180,
          colorStops: [
            { offset: 0, color: appearance.dotsColor },
            { offset: 1, color: appearance.gradientColor2 },
          ],
        }
      : undefined;

  return {
    width: appearance.size,
    height: appearance.size,
    type: "svg" as const,
    data,
    margin: appearance.margin,
    qrOptions: { errorCorrectionLevel: appearance.ecl },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: appearance.logoSizeRatio,
      margin: 6,
      crossOrigin: "anonymous" as const,
    },
    // `gradient` est toujours présent, à `undefined` en mode solide. Omettre la
    // clé ne suffit pas : QRCodeStyling.update() fusionne en profondeur, donc un
    // dégradé posé précédemment survivrait au passage en couleur unie.
    dotsOptions: {
      type: appearance.dotsType,
      color: appearance.dotsColor,
      gradient,
    },
    backgroundOptions: {
      color:
        appearance.bgColorMode === "transparent"
          ? "transparent"
          : appearance.bgColor,
    },
    cornersSquareOptions: {
      type: appearance.cornersSquareType,
      color: appearance.dotsColor,
      gradient,
    },
    cornersDotOptions: {
      type: appearance.cornersDotType,
      color: appearance.dotsColor,
      gradient,
    },
    image: appearance.logoDataUrl || undefined,
  };
}

/**
 * Résumé d'une apparence sur une ligne, pour un en-tête replié.
 *
 * Ne retient que ce qui change visiblement le code : sans cela, replier le
 * panneau ferait perdre de vue les réglages qu'un lot entier va utiliser.
 */
export function describeAppearance(a: QrAppearance): string {
  const parts = [DOTS_TYPE_LABELS[a.dotsType]];
  parts.push(
    a.dotsColorMode === "gradient" ? `${a.dotsColor} → ${a.gradientColor2}` : a.dotsColor
  );
  if (a.bgColorMode === "transparent") parts.push("transparent bg");
  if (a.logoDataUrl) parts.push("logo");
  if (a.showFrameText && a.frameText.trim()) parts.push("caption");
  parts.push(`ECL ${a.ecl}`, `${a.size}px`);
  return parts.join(" · ");
}
