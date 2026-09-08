"use client";

import { useMemo, useState } from "react";
import JSZip from "jszip";
import {
  Alert,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
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
import { downloadBlob, slugify } from "@/lib/utils";
import { QrPreview, renderQrPngBlob } from "./qr-preview";
import { TYPE_ORDER } from "./type-forms";

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
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const expected = useMemo(() => templateHeadersFor(type), [type]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError("");
    setProgress("Reading spreadsheet…");
    try {
      const raw = await parseExcelFile(file);
      if (raw.length === 0) {
        setError("No rows found in the first sheet.");
        setProgress("");
        return;
      }
      if (raw.length > 500) {
        setError("Limited to 500 rows per batch for performance. Only the first 500 will be used.");
      }
      const sliced = raw.slice(0, 500);
      const mapped: BatchRow[] = sliced.map((r, i) => {
        const data = rowToFormData(type, r);
        const payload = data ? buildQrPayload(data) : "";
        const label = data ? labelForRow(type, data, i) : `row-${i + 1} (invalid)`;
        const fnRaw = String(r["filename"] ?? "").trim();
        const filename = `${slugify(fnRaw || label, `${type}-${i + 1}`)}.png`;
        return { index: i, raw: r, data, payload, label, filename };
      });
      setRows(mapped);
      setProgress("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse file.");
      setProgress("");
    }
  };

  const validRows = rows.filter((r) => r.data && r.payload);

  const exportZip = async () => {
    if (validRows.length === 0) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < validRows.length; i++) {
        const r = validRows[i];
        setProgress(`Rendering ${i + 1}/${validRows.length}…`);
        const blob = await renderQrPngBlob(r.payload, appearance);
        zip.file(r.filename, blob);
      }
      setProgress("Compressing ZIP…");
      const out = await zip.generateAsync({ type: "blob" });
      downloadBlob(out, `qr-studio-${type}-batch-${validRows.length}.zip`);
      setProgress("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
      setProgress("");
    } finally {
      setBusy(false);
    }
  };

  const downloadSingle = async (row: BatchRow) => {
    if (!row.data) return;
    const blob = await renderQrPngBlob(row.payload, appearance);
    downloadBlob(blob, row.filename);
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
              onChange={(v) => { if (v) { onTypeChange(v as QrType); setRows([]); } }}
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
              label="Spreadsheet (.xlsx, .xls, .csv — max 500 rows)"
              placeholder="Click to browse"
              accept=".xlsx,.xls,.csv"
              value={null}
              onChange={handleFile}
            />
            {rows.length > 0 && (
              <Button variant="subtle" size="xs" fullWidth onClick={() => setRows([])}>
                Clear {rows.length} rows
              </Button>
            )}
            {progress && <Text size="xs" c="blue">{progress}</Text>}
            {error && <Alert color="red" title="Note">{error}</Alert>}
          </Stack>
        </Card>

        <Card withBorder radius="md" p="md">
          <Stack gap="sm">
            <Title order={6}>3 · Export</Title>
            <Group>
              <Badge>{validRows.length} valid</Badge>
              <Badge variant="outline">{rows.length - validRows.length} invalid</Badge>
            </Group>
            <Button fullWidth disabled={validRows.length === 0 || busy} onClick={exportZip} loading={busy}>
              {busy ? "Rendering…" : `Download ZIP (${validRows.length} PNGs)`}
            </Button>
            <Text size="xs" c="dimmed">
              Every QR uses the Appearance settings. Filenames come from the “filename” column when present.
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
                    <Text size="xs" c="dimmed" truncate ff="monospace" title={r.payload}>{r.payload.slice(0, 80)}</Text>
                    <Button variant="outline" size="xs" fullWidth onClick={() => downloadSingle(r)}>
                      PNG
                    </Button>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}
          {rows.some((r) => !r.data) && (
            <Alert color="red" title={`Skipped ${rows.length - validRows.length} invalid row(s)`}>
              {rows.filter((r) => !r.data).slice(0, 5).map((r) => (
                <Text key={r.index} size="xs">Row {r.index + 2}: missing required fields</Text>
              ))}
            </Alert>
          )}
        </Stack>
      </Card>
    </div>
  );
}
