"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
  Text,
  Textarea,
  ThemeIcon,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconCalendar,
  IconCheck,
  IconCopy,
  IconDownload,
  IconLink,
  IconMail,
  IconMapPin,
  IconMoon,
  IconPhone,
  IconQrcode,
  IconShare,
  IconShare2,
  IconSun,
  IconLetterT,
  IconUser,
  IconWifi,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { downloadBlob, slugify } from "@/lib/utils";
import {
  buildQrPayload,
  defaultDataFor,
  QR_TYPE_META,
  TYPE_ORDER,
  type QrFormData,
  type QrType,
} from "@/lib/qr-payloads";
import {
  DEFAULT_APPEARANCE,
  capacityFor,
  exceedsCapacity,
  payloadByteLength,
  type QrAppearance,
} from "@/lib/qr-appearance";
import { TypeForm } from "@/components/qr-studio/type-forms";
import { QrPreview, renderQrPngBlob } from "@/components/qr-studio/qr-preview";
import { AppearancePanel } from "@/components/qr-studio/appearance-panel";
import { BatchMode } from "@/components/qr-studio/batch-mode";

/**
 * `navigator` n'existe pas au rendu serveur. useSyncExternalStore expose un
 * instantané serveur (`false`) distinct de l'instantané client, donc le premier
 * rendu concorde et l'hydratation ne peut pas échouer — contrairement à un
 * `typeof navigator !== "undefined"` évalué directement dans le JSX.
 */
const neverChanges = () => () => {};
const readShareSupport = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";
const noShareOnServer = () => false;

type PreviewTab = "qr" | "raw";

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
  const [previewTab, setPreviewTab] = useState<PreviewTab>("qr");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const { setColorScheme } = useMantineColorScheme();
  const computedScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });

  const payload = useMemo(() => buildQrPayload(formData), [formData]);
  const bytes = payloadByteLength(payload);
  const capacity = capacityFor(appearance.ecl);
  const overCapacity = exceedsCapacity(payload, appearance.ecl);
  // Un payload trop long fait échouer la génération : on coupe les actions qui
  // rendraient une image plutôt que de laisser l'erreur remonter.
  const canRender = Boolean(payload) && !overCapacity;
  const canShare = useSyncExternalStore(neverChanges, readShareSupport, noShareOnServer);

  const typeBarRef = useRef<HTMLDivElement>(null);

  // La barre des types défile horizontalement : sur un écran étroit, le type
  // actif se retrouve hors champ et rien n'indique lequel est sélectionné. On le
  // ramène dans la vue. `block: "nearest"` évite de faire défiler la page en
  // plus de la barre.
  useEffect(() => {
    typeBarRef.current
      ?.querySelector("[data-type-active]")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [type]);

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
          ? `${formData.firstName} ${formData.lastName}`
          : payload.slice(0, 30);
      downloadBlob(blob, `qr-${type}-${slugify(base, "code")}.png`);
    } catch (e) {
      notifications.show({
        color: "red",
        title: "Export failed",
        message: e instanceof Error ? e.message : "Could not export this QR code.",
      });
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
      notifications.show({
        color: "red",
        title: "Copy unavailable",
        message: "This browser cannot copy images — use Export PNG instead.",
      });
    }
  };

  const handleShare = async () => {
    try {
      // Partager le PNG quand c'est possible ; sinon le payload en texte.
      if (canRender) {
        const blob = await renderQrPngBlob(payload, appearance);
        const file = new File([blob], "qr-code.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "QR Code" });
          return;
        }
      }
      await navigator.share({ text: payload, title: "QR Code" });
    } catch (e) {
      // Fermer la feuille de partage lève AbortError : ce n'est pas un échec.
      if (e instanceof Error && e.name === "AbortError") return;
      notifications.show({
        color: "red",
        title: "Share failed",
        message: e instanceof Error ? e.message : "Could not share this QR code.",
      });
    }
  };

  const handleCopyRaw = async () => {
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Box mih="100vh">
      {/* Header */}
      <Box
        pos="sticky"
        top={0}
        style={{
          zIndex: 20,
          borderBottom: "1px solid var(--mantine-color-default-border)",
          // Suit le schéma de couleurs au lieu d'un blanc figé, tout en gardant
          // la translucidité du bandeau collant.
          background: "color-mix(in srgb, var(--mantine-color-body) 85%, transparent)",
          backdropFilter: "blur(6px)",
        }}
      >
        <Container size={1400} py="sm">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="filled">
                <IconQrcode size={20} />
              </ThemeIcon>
              <Title order={4}>QR Studio</Title>
            </Group>
            <Group gap="xs" wrap="wrap">
              {/* Les deux icônes sont rendues et c'est le CSS qui en masque une.
                  Choisir en JS ferait diverger le rendu serveur du premier rendu
                  client dès qu'un thème explicite est stocké, et l'hydratation
                  échouerait. Le schéma calculé ne sert que dans le gestionnaire
                  de clic, où il n'influence aucun rendu. */}
              <ActionIcon
                variant="default"
                size="lg"
                radius="md"
                onClick={() => setColorScheme(computedScheme === "dark" ? "light" : "dark")}
                aria-label="Toggle colour scheme"
              >
                <IconSun size={18} className="mantine-light-hidden" />
                <IconMoon size={18} className="mantine-dark-hidden" />
              </ActionIcon>
              <SegmentedControl
                value={mode}
                onChange={(v) => setMode(v as "single" | "batch")}
                data={[
                  { value: "single", label: "Single" },
                  { value: "batch", label: "Multiple Codes" },
                ]}
              />
            </Group>
          </Group>
        </Container>
      </Box>

      <Container size={1400} py="lg">
        {mode === "batch" ? (
          <BatchMode type={type} onTypeChange={switchType} appearance={appearance} />
        ) : (
          <Stack gap="lg">
            {/* Les neuf types en une rangée : la colonne verticale qu'ils
                occupaient laissait 1276px de vide sous elle. */}
            <Card withBorder radius="md" p={6}>
              <div className="qr-type-bar" ref={typeBarRef}>
                {TYPE_ORDER.map((t) => (
                  <Button
                    key={t}
                    variant={type === t ? "light" : "subtle"}
                    color={type === t ? "blue" : "gray"}
                    leftSection={TYPE_ICONS[t]}
                    onClick={() => switchType(t)}
                    size="sm"
                    data-type-active={type === t || undefined}
                  >
                    {QR_TYPE_META[t].label}
                  </Button>
                ))}
              </div>
            </Card>

            <div className="qr-single-grid">
              {/* Formulaire et réglages dans la même colonne : voir le
                  commentaire de .qr-single-grid dans globals.css. */}
              <Stack gap="lg" style={{ minWidth: 0 }}>
                <Card withBorder radius="md" p="md">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Title order={4} tt="capitalize">{QR_TYPE_META[type].label}</Title>
                        <Text size="xs" c="dimmed" mt={4}>{QR_TYPE_META[type].hint}</Text>
                      </div>
                      <Badge color={canRender ? "blue" : "red"}>
                        {payload ? `${bytes} / ${capacity} bytes` : "empty"}
                      </Badge>
                    </Group>
                    <TypeForm data={formData} onChange={setFormData} />
                  </Stack>
                </Card>

                <Card withBorder radius="md" p="md">
                  <Stack gap="md">
                    <Title order={5}>✣ Appearance</Title>
                    <AppearancePanel value={appearance} onChange={setAppearance} />
                  </Stack>
                </Card>
              </Stack>

              <div className="qr-sticky-aside">
                <Stack gap="md" style={{ minWidth: 0 }}>
                  <Group justify="space-between">
                    <SegmentedControl
                      value={previewTab}
                      onChange={(v) => setPreviewTab(v as PreviewTab)}
                      data={[
                        { value: "qr", label: "QR Code" },
                        { value: "raw", label: "Raw Code" },
                      ]}
                    />
                    <Group gap="xs">
                      {canShare && (
                        <ActionIcon
                          variant="default"
                          radius="xl"
                          onClick={handleShare}
                          disabled={!payload}
                          aria-label="Share QR code"
                        >
                          <IconShare size={16} />
                        </ActionIcon>
                      )}
                      {canRender && (
                        <ThemeIcon color="green" variant="light" radius="xl" aria-label="Payload is ready">
                          <IconCheck size={16} />
                        </ThemeIcon>
                      )}
                    </Group>
                  </Group>

                  {previewTab === "raw" ? (
                    <Card withBorder radius="md" p="md">
                      <Textarea readOnly rows={14} value={payload} ff="monospace" styles={{ input: { fontSize: 12 } }} />
                    </Card>
                  ) : (
                    <QrPreview payload={payload} appearance={appearance} />
                  )}

                  {/* Les actions accompagnent l'aperçu plutôt que l'en-tête :
                      elles restent à portée pendant tout le défilement. */}
                  <Stack gap="xs">
                    <Button
                      onClick={handleDownload}
                      disabled={busy || !canRender}
                      loading={busy}
                      leftSection={<IconDownload size={16} />}
                      fullWidth
                    >
                      Export PNG
                    </Button>
                    <Group grow gap="xs">
                      <Button
                        variant="outline"
                        onClick={handleCopyImage}
                        disabled={!canRender}
                        leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      >
                        Copy PNG
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCopyRaw}
                        disabled={!payload}
                        leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      >
                        Copy raw
                      </Button>
                    </Group>
                  </Stack>
                </Stack>
              </div>
            </div>
          </Stack>
        )}
      </Container>

      <Box py="md" ta="center" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
        <Container size={1400}>
          <Text size="xs" c="dimmed">
            QR Studio · Mantine v9 · encodings: URL, Text, Email (mailto:), Phone/SMS (tel:/smsto:), Wi-Fi (WIFI:), Location (geo:), Calendar (VEVENT), Person (vCard 3.0), Social links · PNG export
          </Text>
        </Container>
      </Box>
    </Box>
  );
}
