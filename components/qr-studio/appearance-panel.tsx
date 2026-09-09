"use client";

import { useState } from "react";
import {
  Alert,
  ColorInput,
  Divider,
  Group,
  Image,
  NumberInput,
  Select,
  SimpleGrid,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconPhoto } from "@tabler/icons-react";
import { scanabilityWarnings, type QrAppearance } from "@/lib/qr-appearance";
import { FileDropzone, type AcceptMap } from "./file-dropzone";

// Le logo est encodé en data URL et embarqué dans chaque rendu : un fichier
// volumineux ralentirait tout un export de lot.
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

// Les formats que qr-code-styling sait dessiner dans un canvas. Pas de HEIC :
// Chrome et Firefox ne le décodent pas.
const LOGO_ACCEPT: AcceptMap = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/svg+xml": [".svg"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" fw={700} tt="uppercase" c="blue">
      {children}
    </Text>
  );
}

/**
 * Réglages d'apparence, disposés en colonnes.
 *
 * Empilées, les quatre sections faisaient 1182px de haut : 39 % du panneau
 * seulement était visible au chargement et il fallait 719px de défilement pour
 * atteindre la dernière. En colonnes, tout tient dans un écran.
 */
export function AppearancePanel({
  value,
  onChange,
}: {
  value: QrAppearance;
  onChange: (v: QrAppearance) => void;
}) {
  const set = (patch: Partial<QrAppearance>) => onChange({ ...value, ...patch });

  const [logoError, setLogoError] = useState("");

  // Le type et la taille sont filtrés en amont par la zone de dépôt : il ne
  // reste ici que la lecture, dont seul l'échec disque peut encore rater.
  const handleLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => set({ logoDataUrl: String(reader.result ?? "") });
    reader.onerror = () => setLogoError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  const warnings = scanabilityWarnings(value);

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xl" verticalSpacing="lg">
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
          <Group grow gap="xs">
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
          <Text size="sm" mt="xs">Margin: {value.margin}px</Text>
          <Slider value={value.margin} min={0} max={40} step={1} onChange={(v) => set({ margin: v })} />
        </Stack>

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
              <Group grow gap="xs" align="flex-end">
                <Select
                  label="Gradient type"
                  value={value.gradientType}
                  onChange={(v) => v && set({ gradientType: v as QrAppearance["gradientType"] })}
                  data={[
                    { value: "linear", label: "Linear" },
                    { value: "radial", label: "Radial" },
                  ]}
                />
                <NumberInput
                  label="Rotation"
                  value={value.gradientRotation}
                  onChange={(v) => set({ gradientRotation: Number(v) || 0 })}
                  suffix="°"
                />
              </Group>
            </>
          )}
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

        <Stack gap="xs">
          <SectionLabel>Logo &amp; frame</SectionLabel>
          <Text size="sm" fw={500}>Centre logo</Text>
          {/* La vignette prend la place de l'icône : la zone reste la même cible de
              dépôt, et déposer une autre image remplace celle en cours. */}
          <FileDropzone
            onFile={handleLogo}
            onRejectMessage={setLogoError}
            accept={LOGO_ACCEPT}
            acceptLabel="an image (PNG, JPG, SVG, WebP or GIF)"
            maxSize={MAX_LOGO_BYTES}
            inputLabel="Centre logo image"
            idleIcon={
              value.logoDataUrl ? (
                <Image src={value.logoDataUrl} alt="" h={40} w={40} radius="sm" fit="contain" />
              ) : (
                <IconPhoto size={28} stroke={1.5} color="var(--mantine-color-dimmed)" />
              )
            }
          >
            <Text size="sm" fw={500}>
              {value.logoDataUrl ? "Drop to replace" : "Drop an image or click"}
            </Text>
            <Text size="xs" c="dimmed">
              PNG, JPG, SVG · up to {MAX_LOGO_BYTES / 1024 / 1024} MB
            </Text>
          </FileDropzone>
          {logoError && <Text size="xs" c="red">{logoError}</Text>}
          {value.logoDataUrl && (
            <>
              <Group justify="space-between" gap="xs">
                <Text size="sm">Logo size: {Math.round(value.logoSizeRatio * 100)}%</Text>
                <UnstyledButton
                  onClick={() => { setLogoError(""); set({ logoDataUrl: "" }); }}
                  style={{ fontSize: 12, color: "var(--mantine-color-red-6)", textDecoration: "underline" }}
                >
                  Remove
                </UnstyledButton>
              </Group>
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
          <Switch
            mt="xs"
            label="Caption under QR"
            checked={value.showFrameText}
            onChange={(e) => set({ showFrameText: e.currentTarget.checked })}
          />
          {value.showFrameText && (
            <TextInput
              aria-label="Caption text"
              value={value.frameText}
              onChange={(e) => set({ frameText: e.currentTarget.value })}
              placeholder="Scan for…"
            />
          )}
        </Stack>
      </SimpleGrid>

      <Divider />

      <Group align="flex-end" gap="xl" wrap="wrap">
        <Stack gap="xs" style={{ flex: "1 1 320px", minWidth: 0 }}>
          <SectionLabel>Quality</SectionLabel>
          <Group grow gap="xs">
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
          <Alert
            color="yellow"
            title="This code may be hard to scan"
            style={{ flex: "2 1 420px", minWidth: 0 }}
          >
            <Stack gap={4}>
              {warnings.map((w) => (
                <Text key={w} size="xs">{w}</Text>
              ))}
            </Stack>
          </Alert>
        )}
      </Group>
    </Stack>
  );
}
