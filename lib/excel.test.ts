import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseExcelFile } from "./excel";
import { buildQrPayload, rowToFormData, templateHeadersFor } from "./qr-payloads";

/** Construit un vrai fichier .xlsx en mémoire depuis un tableau de lignes. */
function workbookFile(rows: unknown[][], sheetName = "Sheet1", extraSheets: [string, unknown[][]][] = []) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  for (const [name, data] of extraSheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), name);
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([buf], "test.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("parseExcelFile", () => {
  it("lit les lignes de la première feuille en objets", async () => {
    const rows = await parseExcelFile(
      workbookFile([
        ["url", "filename"],
        ["https://a.example", "a"],
        ["https://b.example", "b"],
      ])
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ url: "https://a.example", filename: "a" });
  });

  it("ignore les feuilles au-delà de la première", async () => {
    const rows = await parseExcelFile(
      workbookFile(
        [["url"], ["https://premiere.example"]],
        "Premiere",
        [["Deuxieme", [["url"], ["https://ignoree.example"]]]]
      )
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe("https://premiere.example");
  });

  it("rogne les espaces des en-têtes et des valeurs", async () => {
    const rows = await parseExcelFile(
      workbookFile([
        ["  url  ", " filename "],
        ["  https://a.example  ", "  a  "],
      ])
    );
    expect(Object.keys(rows[0])).toEqual(["url", "filename"]);
    expect(rows[0]).toMatchObject({ url: "https://a.example", filename: "a" });
  });

  it("remplit les cellules vides plutôt que d'omettre la clé", async () => {
    const rows = await parseExcelFile(
      workbookFile([
        ["to", "subject", "body"],
        ["a@b.c", "", ""],
      ])
    );
    expect(rows[0]).toHaveProperty("subject", "");
    expect(rows[0]).toHaveProperty("body", "");
  });

  it("renvoie un tableau vide pour une feuille sans données", async () => {
    expect(await parseExcelFile(workbookFile([]))).toEqual([]);
    expect(await parseExcelFile(workbookFile([["url", "filename"]]))).toEqual([]);
  });

  it("préserve les nombres", async () => {
    const rows = await parseExcelFile(
      workbookFile([
        ["latitude", "longitude"],
        [48.85, 2.35],
      ])
    );
    expect(rows[0].latitude).toBe(48.85);
  });
});

describe("parseExcelFile — cellules date", () => {
  // Le garde-fou du bug #6 : sans cellDates, ces cellules arrivaient en série
  // numérique Excel (46296.74) et toutes les dates étaient perdues en silence.
  it("livre des objets Date et non des séries numériques", async () => {
    const rows = await parseExcelFile(
      workbookFile([
        ["title", "start", "end"],
        ["Launch", new Date(2026, 9, 1, 18, 0), new Date(2026, 9, 1, 20, 0)],
      ])
    );
    expect(rows[0].start).toBeInstanceOf(Date);
    expect(rows[0].end).toBeInstanceOf(Date);
  });

  it("aboutit à un VEVENT daté de bout en bout", async () => {
    const rows = await parseExcelFile(
      workbookFile([
        ["title", "start", "end"],
        ["Launch", new Date(2026, 9, 1, 18, 0), new Date(2026, 9, 1, 20, 0)],
      ])
    );
    const data = rowToFormData("calendar", rows[0]);
    expect(data).not.toBeNull();
    const payload = buildQrPayload(data!);
    expect(payload).toContain("DTSTART:20261001T180000");
    expect(payload).toContain("DTEND:20261001T200000");
  });
});

describe("parseExcelFile — chaîne complète depuis un template", () => {
  it("accepte un fichier bâti sur les en-têtes du template person", async () => {
    const headers = templateHeadersFor("person");
    const row = headers.map((h) => (h === "filename" ? "" : `v-${h}`));
    const rows = await parseExcelFile(workbookFile([headers, row]));
    const data = rowToFormData("person", rows[0]);
    expect(data).not.toBeNull();
    expect(buildQrPayload(data!)).toContain("BEGIN:VCARD");
  });

  it("tolère des en-têtes recasés à la main dans Excel", async () => {
    const rows = await parseExcelFile(
      workbookFile([
        ["FirstName", "LastName", "Email"],
        ["Emily", "Turner", "em@acme.com"],
      ])
    );
    const data = rowToFormData("person", rows[0]);
    expect(data).not.toBeNull();
    expect(buildQrPayload(data!)).toContain("FN:Emily Turner");
  });
});
