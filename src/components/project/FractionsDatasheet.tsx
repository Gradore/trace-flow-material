/**
 * Customer facing specification sheet for an output fraction.
 *
 * The sheet is deliberately honest: measured values are printed as measured,
 * missing values are printed as "nicht gemessen" and never estimated, and for
 * the compound fraction F4 the recyclate is put next to typical virgin
 * PP-GF / PA6-GF data so nobody can claim they were not told.
 */
import jsPDF from "jspdf";
import { downloadPDF } from "@/lib/pdf";
import { GO_NO_GO, PROCESS_LINES, labelOf } from "@/lib/project/constants";
import type { ProductTestResult } from "@/lib/project/types";
import {
  compoundMeasurements,
  formatSpecWindow,
  formatVerdictValue,
  VERDICT_LABEL,
  type FractionView,
} from "./FractionsShared";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

/** Typical virgin reference data, 30 % glass fibre, injection moulded, dry. */
interface VirginReference {
  parameterKey: string;
  label: string;
  unit: string;
  ppGf30: number | null;
  pa6Gf30: number | null;
}

const VIRGIN_REFERENCE: VirginReference[] = [
  { parameterKey: "tensile_strength_mpa", label: "Zugfestigkeit", unit: "MPa", ppGf30: 85, pa6Gf30: 180 },
  { parameterKey: "flexural_strength_mpa", label: "Biegezugfestigkeit", unit: "MPa", ppGf30: 130, pa6Gf30: 260 },
  { parameterKey: "e_modulus_mpa", label: "E-Modul", unit: "MPa", ppGf30: 6000, pa6Gf30: 9500 },
  { parameterKey: "charpy_kj_m2", label: "Charpy gekerbt (23 °C)", unit: "kJ/m²", ppGf30: 10, pa6Gf30: 13 },
  { parameterKey: "hdt_c", label: "HDT/A (1,8 MPa)", unit: "°C", ppGf30: 150, pa6Gf30: 200 },
];

const num = (value: number, digits = 1) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(value);

interface Column {
  header: string;
  width: number;
  align?: "left" | "right";
}

interface Cursor {
  y: number;
  page: number;
}

function newPage(pdf: jsPDF, cursor: Cursor): void {
  pdf.addPage();
  cursor.page += 1;
  cursor.y = MARGIN;
}

function ensureSpace(pdf: jsPDF, cursor: Cursor, needed: number): void {
  if (cursor.y + needed > PAGE_HEIGHT - MARGIN - 12) newPage(pdf, cursor);
}

function sectionTitle(pdf: jsPDF, cursor: Cursor, text: string): void {
  ensureSpace(pdf, cursor, 12);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(20, 20, 20);
  pdf.text(text, MARGIN, cursor.y);
  cursor.y += 1.5;
  pdf.setDrawColor(190, 190, 190);
  pdf.line(MARGIN, cursor.y, MARGIN + CONTENT_WIDTH, cursor.y);
  cursor.y += 5;
}

function paragraph(pdf: jsPDF, cursor: Cursor, text: string, options?: { size?: number; grey?: boolean }): void {
  const size = options?.size ?? 8.5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(size);
  pdf.setTextColor(options?.grey ? 105 : 40);
  const lines = pdf.splitTextToSize(text, CONTENT_WIDTH) as string[];
  for (const line of lines) {
    ensureSpace(pdf, cursor, 6);
    pdf.text(line, MARGIN, cursor.y);
    cursor.y += size * 0.42 + 1.4;
  }
  cursor.y += 1.5;
}

/** Two-column key/value block, mobile of the paper world: never overflows. */
function keyValueBlock(pdf: jsPDF, cursor: Cursor, entries: [string, string][]): void {
  const labelWidth = 46;
  for (const [label, value] of entries) {
    const lines = pdf.splitTextToSize(value, CONTENT_WIDTH - labelWidth) as string[];
    ensureSpace(pdf, cursor, lines.length * 5 + 2);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(90);
    pdf.text(label, MARGIN, cursor.y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(20);
    lines.forEach((line, index) => {
      pdf.text(line, MARGIN + labelWidth, cursor.y + index * 4.4);
    });
    cursor.y += lines.length * 4.4 + 1.6;
  }
  cursor.y += 2;
}

function drawTable(pdf: jsPDF, cursor: Cursor, columns: Column[], rows: string[][]): void {
  const drawHeader = () => {
    ensureSpace(pdf, cursor, 12);
    pdf.setFillColor(238, 238, 240);
    pdf.rect(MARGIN, cursor.y - 4, CONTENT_WIDTH, 6.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(50);
    let x = MARGIN;
    columns.forEach((column) => {
      const text = column.header;
      if (column.align === "right") pdf.text(text, x + column.width - 2, cursor.y, { align: "right" });
      else pdf.text(text, x + 2, cursor.y);
      x += column.width;
    });
    cursor.y += 5;
  };

  drawHeader();

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);

  rows.forEach((row, rowIndex) => {
    const cellLines = row.map((cell, index) =>
      pdf.splitTextToSize(cell ?? "", Math.max(columns[index].width - 4, 8)) as string[],
    );
    const lineCount = Math.max(1, ...cellLines.map((lines) => lines.length));
    const rowHeight = lineCount * 4 + 2;

    if (cursor.y + rowHeight > PAGE_HEIGHT - MARGIN - 12) {
      newPage(pdf, cursor);
      drawHeader();
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
    }

    if (rowIndex % 2 === 1) {
      pdf.setFillColor(249, 249, 250);
      pdf.rect(MARGIN, cursor.y - 3.6, CONTENT_WIDTH, rowHeight, "F");
    }

    let x = MARGIN;
    columns.forEach((column, index) => {
      pdf.setTextColor(25);
      cellLines[index].forEach((line, lineIndex) => {
        const y = cursor.y + lineIndex * 4;
        if (column.align === "right") pdf.text(line, x + column.width - 2, y, { align: "right" });
        else pdf.text(line, x + 2, y);
      });
      x += column.width;
    });

    cursor.y += rowHeight;
    pdf.setDrawColor(226, 226, 228);
    pdf.line(MARGIN, cursor.y - 3.2, MARGIN + CONTENT_WIDTH, cursor.y - 3.2);
  });

  cursor.y += 3;
}

function drawFooters(pdf: jsPDF, totalPages: number, code: string): void {
  const printedAt = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(210);
    pdf.line(MARGIN, PAGE_HEIGHT - MARGIN - 6, MARGIN + CONTENT_WIDTH, PAGE_HEIGHT - MARGIN - 6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(120);
    pdf.text(
      `Werkstoffdatenblatt ${code} · erstellt am ${printedAt} · Messwerte aus Laboranalytik, keine zugesicherte Eigenschaft`,
      MARGIN,
      PAGE_HEIGHT - MARGIN - 2,
    );
    pdf.text(`Seite ${page}/${totalPages}`, MARGIN + CONTENT_WIDTH, PAGE_HEIGHT - MARGIN - 2, { align: "right" });
  }
}

export function buildFractionDatasheet(view: FractionView, productTestResults: ProductTestResult[]): Blob {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const cursor: Cursor = { y: MARGIN, page: 1 };
  const { fraction, spec, run } = view;

  // ------------------------------------------------------------- head
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(120);
  pdf.text("RECYTRACK — GFK-REZYKLAT", MARGIN, cursor.y);
  pdf.setFontSize(9);
  pdf.text("WERKSTOFFDATENBLATT", MARGIN + CONTENT_WIDTH, cursor.y, { align: "right" });
  cursor.y += 8;

  pdf.setFontSize(20);
  pdf.setTextColor(15);
  pdf.text(fraction.fraction_code, MARGIN, cursor.y);
  cursor.y += 7;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(60);
  pdf.text(
    spec ? `${spec.id} — ${spec.name}` : "Ohne Zielfraktion",
    MARGIN,
    cursor.y,
  );
  cursor.y += 8;

  // ------------------------------------------------------- master data
  const processLineLabel = spec?.process_line ? labelOf(PROCESS_LINES, spec.process_line) : "—";
  keyValueBlock(pdf, cursor, [
    ["Zielfraktion", spec ? `${spec.id} — ${spec.name}` : "—"],
    ["Anwendung", spec?.application ?? "—"],
    ["Prozesslinie", processLineLabel],
    ["Versuchslauf", run ? `${run.run_code}${run.title ? ` — ${run.title}` : ""}` : "—"],
    ["Menge", `${num(fraction.weight_kg, 1)} kg${fraction.yield_pct !== null ? ` (Ausbeute ${num(fraction.yield_pct, 2)} %)` : ""}`],
    ["Lagerort", fraction.storage_location ?? "—"],
    ["Rückstellmuster", fraction.retained_sample_kg !== null ? `${num(fraction.retained_sample_kg, 2)} kg` : "nicht angelegt"],
    ["Freigabe Produkttest", fraction.released_for_product_test ? "freigegeben" : "nicht freigegeben"],
    ["Stand", new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })],
  ]);

  // ------------------------------------------------ measured vs. spec
  sectionTitle(pdf, cursor, "Messwerte gegenüber Zielspezifikation");
  if (view.verdicts.length === 0) {
    paragraph(
      pdf,
      cursor,
      "Für diese Fraktion liegen noch keine Analyseergebnisse vor. Es werden bewusst keine Werte geschätzt.",
      { grey: true },
    );
  } else {
    drawTable(
      pdf,
      cursor,
      [
        { header: "Kennwert", width: 62 },
        { header: "Ist", width: 34, align: "right" },
        { header: "Soll", width: 46, align: "right" },
        { header: "Bewertung", width: 38 },
      ],
      view.verdicts.map((verdict) => [
        verdict.label,
        formatVerdictValue(verdict),
        formatSpecWindow(verdict),
        VERDICT_LABEL[verdict.level],
      ]),
    );
  }

  if (view.breaches.length > 0) {
    sectionTitle(pdf, cursor, "Grenzwertverletzungen (Go/No-Go)");
    view.breaches.forEach((breach) => paragraph(pdf, cursor, `• ${breach}`));
    paragraph(
      pdf,
      cursor,
      `Prüfschwellen: Faserlänge Median ≥ ${num(GO_NO_GO.fiberLengthMedianMinMm, 2)} mm, ` +
        `spezifischer Energiebedarf ≤ ${num(GO_NO_GO.energyMaxKwhPerTon, 0)} kWh/t, ` +
        `Glasgehalt ≥ ${num(GO_NO_GO.glassContentMinPct, 0)} %.`,
      { grey: true },
    );
  }

  // ---------------------------------------- F4: honest virgin comparison
  if (fraction.target_fraction_id === "F4") {
    sectionTitle(pdf, cursor, "Ehrliche Gegenüberstellung gegenüber Neuware");
    paragraph(
      pdf,
      cursor,
      "Rezyklatfasern aus GFK sind kürzer als Neuwarefasern und ihre Schlichte ist durch Aushärtung und " +
        "mechanische Aufbereitung vorgeschädigt. Ein Abfall der mechanischen Kennwerte gegenüber Neuware ist " +
        "systembedingt und wird hier offen ausgewiesen. Nicht gemessene Kennwerte werden nicht geschätzt.",
    );

    const ppMeasured = compoundMeasurements(view, productTestResults, "compound_pp");
    const pa6Measured = compoundMeasurements(view, productTestResults, "compound_pa6");

    const cell = (reference: number | null, measured: { value: number } | undefined) => {
      if (!measured) return "nicht gemessen";
      const value = num(measured.value, 1);
      if (reference === null || reference === 0) return value;
      const delta = ((measured.value - reference) / reference) * 100;
      const sign = delta > 0 ? "+" : "−";
      return `${value} (${sign}${num(Math.abs(delta), 0)} %)`;
    };

    drawTable(
      pdf,
      cursor,
      [
        { header: "Kennwert", width: 46 },
        { header: "Einheit", width: 17 },
        { header: "Neuware PP-GF30", width: 27, align: "right" },
        { header: "Rezyklat PP", width: 30, align: "right" },
        { header: "Neuware PA6-GF30", width: 28, align: "right" },
        { header: "Rezyklat PA6", width: 32, align: "right" },
      ],
      VIRGIN_REFERENCE.map((reference) => [
        reference.label,
        reference.unit,
        reference.ppGf30 === null ? "—" : num(reference.ppGf30, 0),
        cell(reference.ppGf30, ppMeasured.get(reference.parameterKey)),
        reference.pa6Gf30 === null ? "—" : num(reference.pa6Gf30, 0),
        cell(reference.pa6Gf30, pa6Measured.get(reference.parameterKey)),
      ]),
    );

    const sources = [...ppMeasured.values(), ...pa6Measured.values()];
    const testCodes = Array.from(new Set(sources.map((entry) => entry.testCode)));
    const dosages = Array.from(
      new Set(sources.map((entry) => entry.dosagePct).filter((d): d is number => d !== null)),
    ).sort((a, b) => a - b);

    paragraph(
      pdf,
      cursor,
      "Neuware-Spalten: typische Richtwerte handelsüblicher 30-%-Glasfaser-Compounds, spritzgegossen, " +
        "trocken geprüft. Sie stammen nicht aus eigenen Messungen und dienen ausschließlich der Einordnung.",
      { grey: true },
    );
    if (testCodes.length > 0) {
      paragraph(
        pdf,
        cursor,
        `Rezyklat-Spalten aus Produkttest ${testCodes.join(", ")}` +
          (dosages.length ? ` bei ${dosages.map((d) => `${num(d, 1)} %`).join(" / ")} Dosierung.` : "."),
        { grey: true },
      );
    } else {
      paragraph(
        pdf,
        cursor,
        "Für diese Fraktion liegen noch keine Compound-Produkttests vor. Die Rezyklat-Spalten bleiben bewusst leer.",
        { grey: true },
      );
    }
  }

  // ------------------------------------------------------------- notes
  if (fraction.notes) {
    sectionTitle(pdf, cursor, "Hinweise");
    paragraph(pdf, cursor, fraction.notes);
  }
  if (spec?.notes) {
    sectionTitle(pdf, cursor, "Hinweise zur Zielspezifikation");
    paragraph(pdf, cursor, spec.notes);
  }

  drawFooters(pdf, cursor.page, fraction.fraction_code);

  return pdf.output("blob");
}

export function downloadFractionDatasheet(view: FractionView, productTestResults: ProductTestResult[]): void {
  const blob = buildFractionDatasheet(view, productTestResults);
  downloadPDF(blob, `Datenblatt_${view.fraction.fraction_code}.pdf`);
}
