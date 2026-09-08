"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Box, Paper, Text } from "@mantine/core";
import QRCodeStyling from "qr-code-styling";
import {
  appearanceToStylingOptions,
  capacityFor,
  captionColorFor,
  captionFontSize,
  exceedsCapacity,
  payloadByteLength,
  type QrAppearance,
} from "@/lib/qr-appearance";

/**
 * Famille de police de la légende, lue depuis la variable posée par next/font.
 * Le canvas ne comprend pas les var() CSS, il faut donc résoudre la valeur.
 */
function captionFontStack() {
  if (typeof document === "undefined") return "sans-serif";
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-geist-sans")
    .trim();
  return value ? `${value}, sans-serif` : "sans-serif";
}

export function QrPreview({
  payload,
  appearance,
  compact = false,
}: {
  payload: string;
  appearance: QrAppearance;
  compact?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const [failure, setFailure] = useState<{ signature: string; message: string } | null>(null);

  const overCapacity = exceedsCapacity(payload, appearance.ecl);
  // Seuls le payload et le niveau de correction déterminent si la génération
  // peut échouer : les couleurs et les formes n'y changent rien. Rattacher
  // l'échec à cette signature permet de le périmer au rendu, sans avoir à le
  // remettre à zéro depuis l'effet (ce qui provoquerait des rendus en cascade).
  const signature = `${appearance.ecl}|${payload}`;

  useEffect(() => {
    // Au-delà de la capacité, le générateur lève « code length overflow ». On
    // n'essaie même pas : l'exception remonterait hors de l'effet et casserait
    // l'arbre React, faute d'error boundary.
    if (overCapacity) return;
    try {
      const opts = appearanceToStylingOptions(appearance, payload || " ");
      if (!qrRef.current) {
        qrRef.current = new QRCodeStyling(opts);
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          qrRef.current.append(containerRef.current);
        }
      } else {
        qrRef.current.update(opts);
      }
    } catch (e) {
      // Remonter l'échec d'une bibliothèque impérative est précisément le cas
      // que cette règle ne couvre pas : le setState ne part qu'en cas d'erreur,
      // une seule fois par signature, donc aucun rendu en cascade possible.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailure({
        signature,
        message: e instanceof Error ? e.message : "Could not generate this QR code.",
      });
    }
  }, [payload, appearance, overCapacity, signature]);

  const renderError = failure?.signature === signature ? failure.message : null;

  const bytes = payloadByteLength(payload);
  const capacity = capacityFor(appearance.ecl);

  return (
    <Paper withBorder p="md" radius="md">
      {overCapacity && (
        <Alert color="red" title="Payload too long" mb="md">
          {bytes} bytes for a {capacity}-byte capacity at error correction{" "}
          {appearance.ecl}. Shorten the content, or lower the error correction level
          (L holds {capacityFor("L")} bytes).
        </Alert>
      )}
      {!overCapacity && renderError && (
        <Alert color="red" title="Render failed" mb="md">
          {renderError}
        </Alert>
      )}
      {/* Le conteneur reste monté même masqué : l'instance QRCodeStyling écrit
          dans ce nœud précis et le démonter la laisserait dessiner dans le vide. */}
      <Box
        mx="auto"
        p="sm"
        style={{
          display: overCapacity ? "none" : undefined,
          width: "fit-content",
          maxWidth: "100%",
          borderRadius: 8,
          background:
            appearance.bgColorMode === "transparent"
              ? "repeating-conic-gradient(#e5e5e5 0% 25%, #fff 0% 50%) 0 0 / 20px 20px"
              : appearance.bgColor,
        }}
      >
        <div
          ref={containerRef}
          className="qr-preview-stage"
          style={{ width: "100%", maxWidth: compact ? 220 : 300, margin: "0 auto" }}
        />
        {appearance.showFrameText && appearance.frameText && (
          <Text mt="xs" ta="center" size="sm" fw={600} c={captionColorFor(appearance)}>
            {appearance.frameText}
          </Text>
        )}
      </Box>
    </Paper>
  );
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed."))),
      "image/png"
    );
  });
}

/**
 * Rend le QR en PNG, légende incluse.
 *
 * qr-code-styling ne sait pas dessiner de texte : la légende est composée sur un
 * canvas au-dessus du QR. Sans cela l'aperçu affiche un texte que le fichier
 * exporté ne contient pas.
 */
export async function renderQrPngBlob(
  payload: string,
  appearance: QrAppearance
): Promise<Blob> {
  if (exceedsCapacity(payload, appearance.ecl)) {
    throw new Error(
      `Payload is ${payloadByteLength(payload)} bytes, over the ` +
        `${capacityFor(appearance.ecl)} bytes available at error correction ${appearance.ecl}.`
    );
  }

  const qr = new QRCodeStyling({
    ...appearanceToStylingOptions(appearance, payload || " "),
    type: "canvas",
  });
  const raw = await qr.getRawData("png");
  if (!raw) throw new Error("Could not generate this QR code.");
  const qrBlob = raw as Blob;

  const caption = appearance.showFrameText ? appearance.frameText.trim() : "";
  if (!caption) return qrBlob;

  if (typeof createImageBitmap !== "function") return qrBlob;
  const bitmap = await createImageBitmap(qrBlob);
  // close() remet width/height à 0 : on retient les dimensions avant de libérer.
  const qrWidth = bitmap.width;
  const qrHeight = bitmap.height;
  const fontSize = captionFontSize(appearance.size);
  const gap = Math.round(fontSize * 0.5);
  const band = gap + fontSize + Math.round(fontSize * 0.7);

  const canvas = document.createElement("canvas");
  canvas.width = qrWidth;
  canvas.height = qrHeight + band;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return qrBlob;
  }

  if (appearance.bgColorMode !== "transparent") {
    ctx.fillStyle = appearance.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  // Sans cette attente, la première exportation peut utiliser la police de
  // repli parce que Geist n'est pas encore chargée.
  try {
    await document.fonts?.ready;
  } catch {
    /* non bloquant */
  }

  ctx.fillStyle = captionColorFor(appearance);
  ctx.font = `600 ${fontSize}px ${captionFontStack()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(caption, canvas.width / 2, qrHeight + gap + fontSize / 2, canvas.width * 0.92);

  return canvasToPngBlob(canvas);
}
