"use client";

import { useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  Alert,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { parseExcelFile, downloadTemplate } from "@/lib/excel";
import {
  buildQrPayload,
  labelForRow,
  rowToFormData,
  templateHeadersFor,
  type QrFormData,
  type QrType,
} from "@/lib/qr-payloads";
import type { QrAppearance } from "@/lib/qr-appearance";
import { dedupeFilenames, downloadBlob, slugify } from "@/lib/utils";
import { QrPreview, renderQrPngBlob } from "./qr-preview";
import { TYPE_ORDER } from "./type-forms";

const MAX_ROWS = 500;

interface BatchRow {
  index: number;
  raw: Record<string, unknown>;
  data: QrFormData | null;
  payload: string;
  label: string;
  filename: string;
}

export function BatchMode({
  type,
  onTypeChange,
  appearance,
}: {
  type: QrType;
  onTypeChange: (t: QrType) => void;
  appearance: QrAppearance;
}) {
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  // Un import réussi mais partiel n'est pas une erreur : le distinguer évite
  // l'alerte rouge sur un fichier correctement chargé.
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const cancelRef = useRef(false);

  const expected = useMemo(() => templateHeadersFor(type), [type]);
  const validRows = useMemo(() => rows.filter((r) => r.data && r.payload), [rows]);
  const invalidRows = useMemo(() => rows.filter((r) => !r.data), [rows]);

  const reset = () => {
    setRows([]);
    setWarning("");
    setError("");
    setStatus("");
    setDone(0);
    setTotal(0);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setWarning("");
    setError("");
    setStatus("Reading spreadsheet…");
    try {
      const raw = await parseExcelFile(file);
      if (raw.length === 0) {
        setError("No rows found in the first sheet.");
        setStatus("");
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
        return { index: i, raw: r, data, payload, label, base: `${slugify(explicit || label, `${type}-${i + 1}`)}.png` };
      });

      // Les noms ne sont dédupliqués qu'entre les lignes réellement exportées,
      // pour qu'une ligne invalide ne consomme pas un nom au passage.
      const names = dedupeFilenames(parsed.filter((r) => r.data).map((r) => r.base));
      let n = 0;
      setRows(
        parsed.map(({ base, ...r }) => ({ ...r, filename: r.data ? names[n++] : base }))
      );
      setStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file.");
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
    <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 380px))", alignItems: "start" }}>
      <Stack gap="md">
        <Card withBorder radius="md" p="md">
          <Stack gap="sm">
            <Title order={6}>1 · Choose type & template</Title>
            <Select
              label="QR type"
              value={type}
              onChange={(v) => { if (v) { onTypeChange(v as QrType); reset(); } }}
              data={TYPE_ORDER.map((t) => ({ value: t, label: t }))}
            />
            <div style={{ background: "var(--mantine-color-gray-1)", borderRadius: 8, padding: 12 }}>
              <Text size="xs" fw={600}>Expected columns:</Text>
              <Text size="xs" ff="monospace" mt={4}>{expected.join(", ")}</Text>
            </div>
            <Button variant="outline" fullWidth onClick={() => downloadTemplate(type)}>
              Download template
            </Button>
          </Stack>
        </Card>

        <Card withBorder radius="md" p="md">
          <Stack gap="sm">
            <Title order={6}>2 · Import Excel / CSV</Title>
            <FileInput
              label={`Spreadsheet (.xlsx, .xls, .csv — max ${MAX_ROWS} rows)`}
              placeholder="Click to browse"
              accept=".xlsx,.xls,.csv"
              value={null}
              onChange={handleFile}
            />
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

        <Card withBorder radius="md" p="md">
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
            <Text size="xs" c="dimmed">
              Every QR uses the Appearance settings. Filenames come from the “filename” column when
              present, and duplicates get a numbered suffix so nothing is overwritten.
            </Text>
          </Stack>
        </Card>
      </Stack>

      <Card withBorder radius="md" p="md" style={{ minHeight: 400 }}>
        <Stack gap="md">
          <Title order={6}>Preview — first {Math.min(12, validRows.length)} of {validRows.length}</Title>
          {validRows.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py={60}>
              No rows yet. Download the template, fill it, then import it.
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
              {validRows.slice(0, 12).map((r) => (
                <Card key={r.index} withBorder radius="md" p="sm">
                  <Stack gap="xs">
                    <QrPreview payload={r.payload} appearance={{ ...appearance, size: 320, showFrameText: false }} compact />
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
    </div>
  );
}
