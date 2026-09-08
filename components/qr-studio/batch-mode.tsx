"use client";

import { useMemo, useState } from "react";
import JSZip from "jszip";
import { Download, FileSpreadsheet, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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

  const handleFile = async (file: File | undefined) => {
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
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">1 · Choose type & template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label className="text-xs text-muted-foreground">QR type</Label>
            <Select value={type} onValueChange={(v) => { onTypeChange(v as QrType); setRows([]); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_ORDER.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="rounded-md bg-muted p-3 text-xs">
              <p className="font-medium">Expected columns:</p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed">{expected.join(", ")}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => downloadTemplate(type)}>
              <FileSpreadsheet /> Download template
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">2 · Import Excel / CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="batch-file" className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center hover:bg-muted/50">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Drop .xlsx, .xls or .csv here or click to browse</span>
              <span className="text-xs text-muted-foreground">Max 500 rows</span>
              <Input id="batch-file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            </Label>
            {rows.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setRows([])}>
                <Trash2 /> Clear {rows.length} rows
              </Button>
            )}
            {progress && <p className="text-xs text-blue-600">{progress}</p>}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">3 · Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{validRows.length} valid</Badge>
              <Badge variant="outline">{rows.length - validRows.length} invalid</Badge>
            </div>
            <Button className="w-full" disabled={validRows.length === 0 || busy} onClick={exportZip}>
              <Download /> {busy ? "Rendering…" : `Download ZIP (${validRows.length} PNGs)`}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Every QR uses the Appearance settings on the right. Filenames come from the “filename” column when present.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="min-h-[400px]">
        <CardHeader>
          <CardTitle className="text-sm">Preview — first {Math.min(12, validRows.length)} of {validRows.length}</CardTitle>
        </CardHeader>
        <CardContent>
          {validRows.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <FileSpreadsheet className="h-8 w-8 opacity-50" />
              <p>No rows yet. Download the template, fill it, then import it.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {validRows.slice(0, 12).map((r) => (
                <div key={r.index} className="space-y-2 rounded-lg border p-3">
                  <QrPreview payload={r.payload} appearance={{ ...appearance, size: 320, showFrameText: false }} compact />
                  <p className="truncate text-xs font-medium" title={r.label}>{r.label}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground" title={r.payload}>{r.payload.slice(0, 80)}</p>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => downloadSingle(r)}>
                    <Download /> PNG
                  </Button>
                </div>
              ))}
            </div>
          )}
          {rows.some((r) => !r.data) && (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
              <p className="font-semibold text-destructive">Skipped {rows.length - validRows.length} invalid row(s):</p>
              <ul className="mt-1 list-disc pl-4">
                {rows.filter((r) => !r.data).slice(0, 5).map((r) => (
                  <li key={r.index}>Row {r.index + 2}: missing required fields</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
