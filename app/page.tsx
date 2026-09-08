"use client";

import { useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import {
  IconCalendar,
  IconCheck,
  IconCopy,
  IconDownload,
  IconLink,
  IconMail,
  IconMapPin,
  IconPhone,
  IconQrcode,
  IconShare,
  IconShare2,
  IconLetterT,
  IconUser,
  IconWifi,
} from "@tabler/icons-react";
import { downloadBlob } from "@/lib/utils";
import {
  buildQrPayload,
  defaultDataFor,
  QR_TYPE_META,
  type QrFormData,
  type QrType,
} from "@/lib/qr-payloads";
import { DEFAULT_APPEARANCE, type QrAppearance } from "@/lib/qr-appearance";
import { TypeForm, TYPE_ORDER } from "@/components/qr-studio/type-forms";
import { QrPreview, renderQrPngBlob } from "@/components/qr-studio/qr-preview";
import { AppearancePanel } from "@/components/qr-studio/appearance-panel";
import { BatchMode } from "@/components/qr-studio/batch-mode";

const TYPE_ICONS: Record<QrType, React.ReactNode> = {
  calendar: <IconCalendar size={16} />,
  email: <IconMail size={16} />,
  location: <IconMapPin size={16} />,
  person: <IconUser size={16} />,
  phone: <IconPhone size={16} />,
  social: <IconShare2 size={16} />,
  text: <IconLetterT size={16} />,
  url: <IconLink size={16} />,
  wifi: <IconWifi size={16} />,
};

export default function Home() {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [type, setType] = useState<QrType>("person");
  const [formData, setFormData] = useState<QrFormData>(() => defaultDataFor("person"));
  const [appearance, setAppearance] = useState<QrAppearance>(DEFAULT_APPEARANCE);
  const [previewTab, setPreviewTab] = useState<string | null>("qr");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const payload = useMemo(() => buildQrPayload(formData), [formData]);

  const switchType = (t: QrType) => {
    setType(t);
    setFormData(defaultDataFor(t));
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const blob = await renderQrPngBlob(payload, appearance);
      const base =
        formData.type === "person"
          ? `${(formData.firstName || "").trim()}-${(formData.lastName || "").trim()}`.replace(/^-|-$/g, "") || "contact"
          : payload.slice(0, 30);
      downloadBlob(blob, `qr-${type}-${base.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "code"}.png`);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyImage = async () => {
    try {
      const blob = await renderQrPngBlob(payload, appearance);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("Copy image not supported in this browser — use Download PNG instead.");
    }
  };

  const handleCopyRaw = async () => {
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleShare = async () => {
    try {
      const blob = await renderQrPngBlob(payload, appearance);
      const file = new File([blob], "qr-code.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "QR Code" });
      } else if (navigator.share) {
        await navigator.share({ text: payload, title: "QR Code" });
      } else {
        handleCopyRaw();
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <Box mih="100vh">
      {/* Header */}
      <Box
        pos="sticky"
        top={0}
        style={{ zIndex: 20, borderBottom: "1px solid var(--mantine-color-gray-3)", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(6px)" }}
      >
        <Container size={1400} py="sm">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Group gap="sm">
              <ActionIcon size="lg" radius="md" variant="filled" style={{ pointerEvents: "none" }}>
                <IconQrcode size={20} />
              </ActionIcon>
              <Title order={4}>QR Studio</Title>
              <Badge variant="light" visibleFrom="sm">9 types · single + batch · Mantine v9</Badge>
            </Group>
            <Group gap="xs" wrap="wrap">
              <SegmentedControl
                value={mode}
                onChange={(v) => setMode(v as "single" | "batch")}
                data={[
                  { value: "single", label: "Single" },
                  { value: "batch", label: "Multiple Codes" },
                ]}
              />
              {mode === "single" && (
                <>
                  <Button variant="outline" size="xs" onClick={handleCopyRaw} leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}>
                    Copy raw
                  </Button>
                  <Button variant="outline" size="xs" onClick={handleCopyImage} leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}>
                    Copy PNG
                  </Button>
                  <Button variant="outline" size="xs" onClick={handleShare} leftSection={<IconShare size={14} />}>
                    Share
                  </Button>
                  <Button size="xs" onClick={handleDownload} disabled={busy || !payload} loading={busy} leftSection={<IconDownload size={14} />}>
                    Export PNG
                  </Button>
                </>
              )}
            </Group>
          </Group>
        </Container>
      </Box>

      <Container size={1400} py="lg">
        {mode === "batch" ? (
          <BatchMode type={type} onTypeChange={switchType} appearance={appearance} />
        ) : (
          <div
            style={{
              display: "grid",
              gap: 24,
              gridTemplateColumns: "220px minmax(0, 1fr) minmax(0, 420px)",
              alignItems: "start",
            }}
            className="qr-single-grid"
          >
            {/* Sidebar */}
            <Card withBorder radius="md" p="xs" style={{ position: "sticky", top: 76 }}>
              <Stack gap={2}>
                {TYPE_ORDER.map((t) => (
                  <Button
                    key={t}
                    variant={type === t ? "light" : "subtle"}
                    color={type === t ? "blue" : "gray"}
                    justify="flex-start"
                    leftSection={TYPE_ICONS[t]}
                    onClick={() => switchType(t)}
                    fullWidth
                  >
                    {QR_TYPE_META[t].label}
                  </Button>
                ))}
              </Stack>
            </Card>

            {/* Form */}
            <Card withBorder radius="md" p="md">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Title order={4} tt="capitalize">{QR_TYPE_META[type].label}</Title>
                    <Text size="xs" c="dimmed" mt={4}>{QR_TYPE_META[type].hint}</Text>
                  </div>
                  <Badge color={payload ? "blue" : "red"}>
                    {payload ? `${payload.length} chars` : "empty"}
                  </Badge>
                </Group>
                <TypeForm data={formData} onChange={setFormData} />
              </Stack>
            </Card>

            {/* Preview */}
            <Stack gap="md">
              <Group justify="space-between">
                <Tabs value={previewTab} onChange={setPreviewTab}>
                  <Tabs.List>
                    <Tabs.Tab value="qr">QR Code</Tabs.Tab>
                    <Tabs.Tab value="raw">Raw Code</Tabs.Tab>
                  </Tabs.List>
                </Tabs>
                {payload && (
                  <ActionIcon color="green" variant="light" radius="xl" style={{ pointerEvents: "none" }}>
                    <IconCheck size={16} />
                  </ActionIcon>
                )}
              </Group>

              {previewTab === "raw" ? (
                <Card withBorder radius="md" p="md">
                  <Stack gap="sm">
                    <Textarea readOnly rows={12} value={payload} ff="monospace" styles={{ input: { fontSize: 12 } }} />
                    <Button variant="outline" size="xs" fullWidth onClick={handleCopyRaw} leftSection={<IconCopy size={14} />}>
                      Copy raw payload
                    </Button>
                  </Stack>
                </Card>
              ) : (
                <QrPreview payload={payload} appearance={appearance} />
              )}

              <Card withBorder radius="md" p="md">
                <Stack gap="md">
                  <Title order={5}>✣ Appearance</Title>
                  <AppearancePanel value={appearance} onChange={setAppearance} />
                </Stack>
              </Card>
            </Stack>
          </div>
        )}
      </Container>

      <Box py="md" ta="center" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
        <Container size={1400}>
          <Text size="xs" c="dimmed">
            QR Studio · Mantine v9 · encodings: URL, Text, Email (mailto:), Phone/SMS (tel:/smsto:), Wi-Fi (WIFI:), Location (geo:), Calendar (VEVENT), Person (vCard 3.0), Social links · PNG export
          </Text>
          <Text size="xs" c="dimmed" mt={4} className="qr-single-grid-hint">
            Tip: sidebar stacks below on narrow screens via responsive CSS.
          </Text>
        </Container>
      </Box>
      <style>{`@media (max-width: 1024px) { .qr-single-grid { grid-template-columns: 1fr !important; } }`}</style>
    </Box>
  );
}
