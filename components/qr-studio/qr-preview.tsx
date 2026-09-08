"use client";

import { useEffect, useRef } from "react";
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
    <div className="w-full overflow-hidden rounded-xl border bg-muted/40 p-4">
      <div
        className="mx-auto w-fit max-w-full overflow-hidden rounded-lg bg-white p-3 shadow-sm"
        style={{ background: appearance.bgColorMode === "transparent" ? "repeating-conic-gradient(#e5e5e5 0% 25%, #fff 0% 50%) 0 0 / 20px 20px" : appearance.bgColor }}
      >
        <div
          ref={containerRef}
          className="mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          style={{ width: compact ? 220 : 300 }}
        />
        {appearance.showFrameText && appearance.frameText && (
          <p className="mt-2 text-center text-sm font-semibold text-black">{appearance.frameText}</p>
        )}
      </div>
    </div>
  );
}

export async function renderQrPngBlob(payload: string, appearance: QrAppearance): Promise<Blob> {
  const opts = appearanceToStylingOptions({ ...appearance, size: appearance.size }, payload || " ");
  const qr = new QRCodeStyling({ ...opts, type: "canvas" as unknown as "svg" });
  const blob = (await (qr as unknown as { getRawData: (t: string) => Promise<Blob> }).getRawData("png")) as Blob;
  if (!blob) throw new Error("Failed to render QR");
  return blob;
}
