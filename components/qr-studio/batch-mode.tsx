"use client";

import { useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconFileSpreadsheet } from "@tabler/icons-react";
import { parseExcelFile, downloadTemplate } from "@/lib/excel";
import {
  buildQrPayload,
  labelForRow,
  QR_TYPE_META,
  rowToFormData,
  templateHeadersFor,
  TYPE_ORDER,
  type QrFormData,
  type QrType,
} from "@/lib/qr-payloads";
import { describeAppearance, type QrAppearance } from "@/lib/qr-appearance";
import { dedupeFilenames, downloadBlob, slugify } from "@/lib/utils";
import { AppearancePanel } from "./appearance-panel";
import { FileDropzone, type AcceptMap } from "./file-dropzone";
import { QrPreview, renderQrPngBlob } from "./qr-preview";

const MAX_ROWS = 500;

// `parseExcelFile` charge le classeur entier en mémoire : sans plafond, un
// fichier de plusieurs centaines de mégaoctets figerait l'onglet avant même
// qu'on puisse le tronquer à MAX_ROWS.
const MAX_SHEET_BYTES = 10 * 1024 * 1024;

// Excel étiquette parfois un .csv en `application/vnd.ms-excel`, et un fichier
// venant d'une archive arrive sans type du tout : les extensions rattrapent
// les deux cas.
const SHEET_ACCEPT: AcceptMap = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "text/csv": [".csv"],
};

interface BatchRow {
  index: number;
  data: QrFormData | null;
  payload: string;
  label: string;
  filename: string;
}

export function BatchMode({
  type,
  onTypeChange,
  appearance,
  onAppearanceChange,
}: {
  type: QrType;
  onTypeChange: (t: QrType) => void;
  appearance: QrAppearance;
  onAppearanceChange: (a: QrAppearance) => void;
}) {
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [parsing, setParsing] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  // Un import réussi mais partiel n'est pas une erreur : le distinguer évite
  // l'alerte rouge sur un fichier correctement chargé.
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const cancelRef = useRef(false);

  const expected = useMemo(() => templateHeadersFor(type), [type]);
  // Sans mémoïsation, ce littéral est un nouvel objet à chaque rendu : les douze
  // aperçus voient leurs dépendances changer et se redessinent pour rien.
  const previewAppearance = useMemo(
    () => ({ ...appearance, size: 320, showFrameText: false }),
    [appearance]
  );
  const validRows = useMemo(() => rows.filter((r) => r.data && r.payload), [rows]);
  const invalidRows = useMemo(() => rows.filter((r) => !r.data), [rows]);
  // La première ligne importée sert d'exemplaire aux réglages ; avant tout
  // import, un payload court suffit à montrer formes et couleurs.
  const samplePayload = validRows[0]?.payload ?? "https://example.com";

  const reset = () => {
    setRows([]);
    setWarning("");
    setError("");
    setStatus("");
    setDone(0);
    setTotal(0);
  };

  const handleFile = async (file: File) => {
    setWarning("");
    setError("");
    setParsing(true);
    setStatus("Reading spreadsheet…");
    try {
      const raw = await parseExcelFile(file);
      if (raw.length === 0) {
        setError("No rows found in the first sheet.");
        return;
      }
      const sliced = raw.slice(0, MAX_ROWS);
      if (raw.length > MAX_ROWS) {
        setWarning(
          `The file holds ${raw.length} rows; only the first ${MAX_ROWS} were kept for performance.`
        );
      }

      const parsed = sliced.map((r, i) => {
        const data = rowToFormData(type, r);
        const payload = data ? buildQrPayload(data) : "";
        const label = data ? labelForRow(type, data, i) : `row-${i + 1} (invalid)`;
        const explicit = String(r["filename"] ?? "").trim();
        return { index: i, data, payload, label, base: `${slugify(explicit || label, `${type}-${i + 1}`)}.png` };
      });

      // Les noms ne sont dédupliqués qu'entre les lignes réellement exportées,
      // pour qu'une ligne invalide ne consomme pas un nom au passage.
      const names = dedupeFilenames(parsed.filter((r) => r.data).map((r) => r.base));
      let n = 0;
      setRows(
        parsed.map(({ base, ...r }) => ({ ...r, filename: r.data ? names[n++] : base }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file.");
    } finally {
      setParsing(false);
      setStatus("");
    }
  };

  const exportZip = async () => {
    if (validRows.length === 0) return;
    setBusy(true);
    setError("");
    cancelRef.current = false;
    setTotal(validRows.length);
    setDone(0);
    try {
      const zip = new JSZip();
      for (let i = 0; i < validRows.length; i++) {
        if (cancelRef.current) {
          setStatus("");
          setWarning("Export cancelled — no file was downloaded.");
          return;
        }
        const r = validRows[i];
        setStatus(`Rendering ${i + 1}/${validRows.length}…`);
        const blob = await renderQrPngBlob(r.payload, appearance);
        zip.file(r.filename, blob);
        setDone(i + 1);
      }
      setStatus("Compressing ZIP…");
      const out = await zip.generateAsync({ type: "blob" });
      downloadBlob(out, `qr-studio-${type}-batch-${validRows.length}.zip`);
      setStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
      setStatus("");
    } finally {
      setBusy(false);
      setTotal(0);
      setDone(0);
    }
  };

  const downloadSingle = async (row: BatchRow) => {
    if (!row.data) return;
    try {
      const blob = await renderQrPngBlob(row.payload, appearance);
      downloadBlob(blob, row.filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    }
  };

  return (
    <Stack gap="lg">
      {/* Les trois étapes sont de la configuration ponctuelle : en rangée, elles
          libèrent toute la largeur pour les vignettes, qui sont ce qu'on regarde.
          Empilées, leur colonne faisait 722px face à un panneau de 400px. */}
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Card withBorder radius="md" p="md" h="100%">
          <Stack gap="sm">
            <Title order={6}>1 · Choose type &amp; template</Title>
            <Select
              label="QR type"
              value={type}
              onChange={(v) => { if (v) { onTypeChange(v as QrType); reset(); } }}
              data={TYPE_ORDER.map((t) => ({ value: t, label: QR_TYPE_META[t].label }))}
            />
            <div style={{ background: "var(--mantine-color-default-hover)", borderRadius: 8, padding: 12 }}>
              <Text size="xs" fw={600}>Expected columns:</Text>
              <Text size="xs" ff="monospace" mt={4}>{expected.join(", ")}</Text>
            </div>
            <Button variant="outline" fullWidth mt="auto" onClick={() => downloadTemplate(type)}>
              Download template
            </Button>
          </Stack>
        </Card>

        <Card withBorder radius="md" p="md" h="100%">
          <Stack gap="sm">
            <Title order={6}>2 · Import Excel / CSV</Title>
            <FileDropzone
              onFile={handleFile}
              onRejectMessage={setError}
              accept={SHEET_ACCEPT}
              acceptLabel="a spreadsheet (.xlsx, .xls or .csv)"
              maxSize={MAX_SHEET_BYTES}
              loading={parsing}
              disabled={busy}
              inputLabel="Spreadsheet to import"
              idleIcon={
                <IconFileSpreadsheet size={30} stroke={1.5} color="var(--mantine-color-dimmed)" />
              }
            >
              <Text size="sm" fw={500}>Drop a spreadsheet or click to browse</Text>
              <Text size="xs" c="dimmed">
                .xlsx, .xls or .csv · first {MAX_ROWS} rows
              </Text>
            </FileDropzone>
            {rows.length > 0 && (
              <Button variant="subtle" size="xs" fullWidth onClick={reset} disabled={busy}>
                Clear {rows.length} rows
              </Button>
            )}
            {status && <Text size="xs" c="blue">{status}</Text>}
            {warning && <Alert color="yellow" title="Heads up">{warning}</Alert>}
            {error && <Alert color="red" title="Import failed">{error}</Alert>}
          </Stack>
        </Card>

        <Card withBorder radius="md" p="md" h="100%">
          <Stack gap="sm">
            <Title order={6}>3 · Export</Title>
            <Group>
              <Badge>{validRows.length} valid</Badge>
              <Badge variant="outline" color={invalidRows.length ? "red" : "gray"}>
                {invalidRows.length} invalid
              </Badge>
            </Group>
            {busy && total > 0 && (
              <Stack gap={4}>
                <Progress value={(done / total) * 100} animated />
                <Text size="xs" c="dimmed">{done} / {total} rendered</Text>
              </Stack>
            )}
            <Button fullWidth disabled={validRows.length === 0 || busy} onClick={exportZip} loading={busy}>
              {busy ? "Rendering…" : `Download ZIP (${validRows.length} PNGs)`}
            </Button>
            {busy && (
              <Button variant="outline" color="red" size="xs" fullWidth onClick={() => { cancelRef.current = true; }}>
                Cancel
              </Button>
            )}
            <Text size="xs" c="dimmed" mt="auto">
              Filenames come from the “filename” column when present, and duplicates get a
              numbered suffix so nothing is overwritten.
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>

      {/* Le même objet d'apparence que le mode simple, éditable ici aussi : sans
          cela, styler un lot obligeait à repasser par l'onglet Single. Replié par
          défaut, parce que les vignettes sont ce qu'on vient regarder — et le
          résumé garde les réglages sous les yeux même fermé. */}
      <Accordion variant="separated" radius="md" chevronPosition="left">
        <Accordion.Item value="appearance">
          <Accordion.Control>
            <Group gap="sm" wrap="wrap">
              <Text fw={600} size="sm">✣ Appearance</Text>
              <Text size="xs" c="dimmed">{describeAppearance(appearance)}</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <div className="qr-batch-appearance">
              <AppearancePanel value={appearance} onChange={onAppearanceChange} />
              {/* Réutilise la colonne collante du mode simple : les vignettes
                  sont trop bas pour servir de retour visuel une fois le panneau
                  ouvert. */}
              <div className="qr-sticky-aside">
                <Stack gap="xs">
                  <Text size="xs" fw={700} tt="uppercase" c="blue">
                    {validRows.length > 0 ? "First row" : "Sample"}
                  </Text>
                  <QrPreview payload={samplePayload} appearance={appearance} />
                </Stack>
              </div>
            </div>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <Card withBorder radius="md" p="md" mih={320}>
        <Stack gap="md">
          <Title order={6}>Preview — first {Math.min(12, validRows.length)} of {validRows.length}</Title>
          {validRows.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py={80}>
              No rows yet. Download the template, fill it, then drop it on step 2.
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, md: 4, lg: 5, xl: 6 }} spacing="md">
              {validRows.slice(0, 12).map((r) => (
                <Card key={r.index} withBorder radius="md" p="sm">
                  <Stack gap="xs">
                    <QrPreview payload={r.payload} appearance={previewAppearance} compact />
                    <Text size="xs" fw={600} truncate title={r.label}>{r.label}</Text>
                    <Text size="xs" c="dimmed" truncate ff="monospace" title={r.filename}>{r.filename}</Text>
                    <Button variant="outline" size="xs" fullWidth onClick={() => downloadSingle(r)}>
                      PNG
                    </Button>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}
          {invalidRows.length > 0 && (
            <Alert color="yellow" title={`Skipped ${invalidRows.length} invalid row(s)`}>
              {invalidRows.slice(0, 5).map((r) => (
                <Text key={r.index} size="xs">Row {r.index + 2}: missing or malformed required fields</Text>
              ))}
              {invalidRows.length > 5 && (
                <Text size="xs" mt={4}>…and {invalidRows.length - 5} more.</Text>
              )}
            </Alert>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
