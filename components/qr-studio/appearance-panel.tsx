"use client";

import { useState } from "react";
import {
  Alert,
  ColorInput,
  Divider,
  FileInput,
  Group,
  Image,
  NumberInput,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { scanabilityWarnings, type QrAppearance } from "@/lib/qr-appearance";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" fw={700} tt="uppercase" c="blue">
      {children}
    </Text>
  );
}

export function AppearancePanel({
  value,
  onChange,
}: {
  value: QrAppearance;
  onChange: (v: QrAppearance) => void;
}) {
  const set = (patch: Partial<QrAppearance>) => onChange({ ...value, ...patch });

  const [logoError, setLogoError] = useState("");

  const handleLogo = (file: File | null) => {
    setLogoError("");
    if (!file) {
      set({ logoDataUrl: "" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      setLogoError("That file is not an image.");
      return;
    }
    // Le logo est encodé en data URL et embarqué dans chaque rendu : un fichier
    // volumineux ralentirait tout un export de lot.
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(
        `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB; keep it under ${MAX_LOGO_BYTES / 1024 / 1024} MB.`
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set({ logoDataUrl: String(reader.result ?? "") });
    reader.onerror = () => setLogoError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  const warnings = scanabilityWarnings(value);

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <SectionLabel>Shape</SectionLabel>
        <Select
          label="Pixel style"
          value={value.dotsType}
          onChange={(v) => v && set({ dotsType: v as QrAppearance["dotsType"] })}
          data={[
            { value: "square", label: "Square" },
            { value: "rounded", label: "Rounded" },
            { value: "dots", label: "Dots" },
            { value: "classy", label: "Classy" },
            { value: "classy-rounded", label: "Classy rounded" },
            { value: "extra-rounded", label: "Extra rounded" },
          ]}
        />
        <Group grow>
          <Select
            label="Corners"
            value={value.cornersSquareType}
            onChange={(v) => v && set({ cornersSquareType: v as QrAppearance["cornersSquareType"] })}
            data={[
              { value: "square", label: "Square" },
              { value: "dot", label: "Dot" },
              { value: "extra-rounded", label: "Rounded" },
            ]}
          />
          <Select
            label="Corner dots"
            value={value.cornersDotType}
            onChange={(v) => v && set({ cornersDotType: v as QrAppearance["cornersDotType"] })}
            data={[
              { value: "square", label: "Square" },
              { value: "dot", label: "Dot" },
              { value: "extra-rounded", label: "Rounded" },
            ]}
          />
        </Group>
        <Text size="sm">Margin: {value.margin}px</Text>
        <Slider value={value.margin} min={0} max={40} step={1} onChange={(v) => set({ margin: v })} />
      </Stack>

      <Divider />

      <Stack gap="xs">
        <SectionLabel>Color</SectionLabel>
        <Select
          label="Pixel colour"
          value={value.dotsColorMode}
          onChange={(v) => v && set({ dotsColorMode: v as "solid" | "gradient" })}
          data={[
            { value: "solid", label: "Solid" },
            { value: "gradient", label: "Gradient" },
          ]}
        />
        {value.dotsColorMode === "gradient" && (
          <Select
            label="Gradient type"
            value={value.gradientType}
            onChange={(v) => v && set({ gradientType: v as QrAppearance["gradientType"] })}
            data={[
              { value: "linear", label: "Linear" },
              { value: "radial", label: "Radial" },
            ]}
          />
        )}
        <Group align="flex-end">
          <ColorInput
            label={value.dotsColorMode === "gradient" ? "Gradient start" : "Pixel colour"}
            value={value.dotsColor}
            onChange={(v) => set({ dotsColor: v })}
          />
          {value.dotsColorMode === "gradient" && (
            <>
              <ColorInput
                label="Gradient end"
                value={value.gradientColor2}
                onChange={(v) => set({ gradientColor2: v })}
              />
              <NumberInput
                label="Rotation"
                value={value.gradientRotation}
                onChange={(v) => set({ gradientRotation: Number(v) || 0 })}
                w={90}
                suffix="°"
              />
            </>
          )}
        </Group>
        <Select
          label="Background"
          value={value.bgColorMode}
          onChange={(v) => v && set({ bgColorMode: v as "solid" | "transparent" })}
          data={[
            { value: "solid", label: "Solid" },
            { value: "transparent", label: "Transparent" },
          ]}
        />
        {value.bgColorMode === "solid" && (
          <ColorInput
            label="Background colour"
            value={value.bgColor}
            onChange={(v) => set({ bgColor: v })}
          />
        )}
      </Stack>

      <Divider />

      <Stack gap="xs">
        <SectionLabel>Logo & frame</SectionLabel>
        <FileInput label="Center logo (PNG/JPG)" placeholder="Pick image" accept="image/*" value={null} onChange={handleLogo} clearable={false} />
        {logoError && <Text size="xs" c="red">{logoError}</Text>}
        {value.logoDataUrl && (
          <>
            <Text size="sm">Logo size: {Math.round(value.logoSizeRatio * 100)}% of the code</Text>
            <Slider
              value={value.logoSizeRatio}
              min={0.1}
              max={0.4}
              step={0.01}
              label={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => set({ logoSizeRatio: v })}
            />
          </>
        )}
        {value.logoDataUrl && (
          <Group>
            <Image src={value.logoDataUrl} alt="logo" h={40} w={40} radius="md" fit="contain" />
            <UnstyledButton onClick={() => set({ logoDataUrl: "" })} style={{ fontSize: 12, color: "var(--mantine-color-red-6)", textDecoration: "underline" }}>
              Remove
            </UnstyledButton>
          </Group>
        )}
        <Switch label="Caption under QR" checked={value.showFrameText} onChange={(e) => set({ showFrameText: e.currentTarget.checked })} />
        {value.showFrameText && (
          <TextInput
            aria-label="Caption text"
            value={value.frameText}
            onChange={(e) => set({ frameText: e.currentTarget.value })}
            placeholder="Scan for…"
          />
        )}
      </Stack>

      <Divider />

      <Stack gap="xs">
        <SectionLabel>Quality</SectionLabel>
        <Group grow>
          <Select
            label="Error correction"
            value={value.ecl}
            onChange={(v) => v && set({ ecl: v as QrAppearance["ecl"] })}
            data={[
              { value: "L", label: "L — Low" },
              { value: "M", label: "M — Medium" },
              { value: "Q", label: "Q — Quartile" },
              { value: "H", label: "H — High" },
            ]}
          />
          <Select
            label="Export size (px)"
            value={String(value.size)}
            onChange={(v) => v && set({ size: Number(v) })}
            data={["512", "640", "1024", "2048"]}
          />
        </Group>
      </Stack>
      {warnings.length > 0 && (
        <Alert color="yellow" title="This code may be hard to scan">
          <Stack gap={4}>
            {warnings.map((w) => (
              <Text key={w} size="xs">{w}</Text>
            ))}
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}
