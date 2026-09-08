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
    dotsOptions: {
      type: appearance.dotsType,
      ...(gradient ? { gradient } : { color: appearance.dotsColor }),
    },
    backgroundOptions: {
      color:
        appearance.bgColorMode === "transparent"
          ? "transparent"
          : appearance.bgColor,
    },
    cornersSquareOptions: {
      type: appearance.cornersSquareType,
      ...(gradient ? { gradient } : { color: appearance.dotsColor }),
    },
    cornersDotOptions: {
      type: appearance.cornersDotType,
      ...(gradient ? { gradient } : { color: appearance.dotsColor }),
    },
    image: appearance.logoDataUrl || undefined,
  };
}
