"use client";

import { useEffect, useRef } from "react";
import { Box, Paper, Text } from "@mantine/core";
import QRCodeStyling from "qr-code-styling";
import { appearanceToStylingOptions, type QrAppearance } from "@/lib/qr-appearance";

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

  useEffect(() => {
    const opts = appearanceToStylingOptions(appearance, payload || " ");
    if (!qrRef.current) {
      qrRef.current = new QRCodeStyling({ ...opts, type: "svg" as const });
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
        qrRef.current.append(containerRef.current);
      }
    } else {
      qrRef.current.update(opts);
    }
  }, [payload, appearance]);

  return (
    <Paper withBorder p="md" radius="md">
      <Box
        mx="auto"
        p="sm"
        style={{
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
          <Text mt="xs" ta="center" size="sm" fw={600} c="black">
            {appearance.frameText}
          </Text>
        )}
      </Box>
    </Paper>
  );
}

export async function renderQrPngBlob(payload: string, appearance: QrAppearance): Promise<Blob> {
  const opts = appearanceToStylingOptions({ ...appearance, size: appearance.size }, payload || " ");
  const qr = new QRCodeStyling({ ...opts, type: "canvas" as unknown as "svg" });
  const blob = (await (qr as unknown as { getRawData: (t: string) => Promise<Blob> }).getRawData("png")) as Blob;
  if (!blob) throw new Error("Failed to render QR");
  return blob;
}
