import * as XLSX from "xlsx";
import type { QrType } from "./qr-payloads";
import { templateHeadersFor, templateRowFor } from "./qr-payloads";

export async function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  // cellDates: sans lui, une vraie cellule date Excel arrive en série numérique
  // (46296.74) que new Date() ne sait pas lire — les dates seraient perdues.
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const ws = wb.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  // normalize keys: trim
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      out[k.trim()] = typeof v === "string" ? v.trim() : v;
    }
    return out;
  });
}

export function downloadTemplate(type: QrType) {
  const headers = templateHeadersFor(type);
  const sample = templateRowFor(type);
  const ws = XLSX.utils.json_to_sheet([sample], { header: headers });
  // set column widths
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "QR Codes");
  XLSX.writeFile(wb, `qr-studio-${type}-template.xlsx`);
}
