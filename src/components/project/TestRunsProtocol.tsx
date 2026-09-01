import jsPDF from "jspdf";
import {
  ANALYSIS_STATUSES,
  BATCH_STATUSES,
  FRACTION_STATUSES,
  MACHINE_TYPES,
  MATERIAL_CLASSES,
  TEST_RUN_STATUSES,
  PROCESS_RULE_OF_THUMB,
  labelOf,
} from "@/lib/project/constants";
import { CONFORMITY_META, evaluateResult, goNoGoBreaches } from "@/lib/project/spec";
import type {
  AnalysisResult,
  DoeSeries,
  FractionAnalysis,
  FractionSpec,
  MaterialBatch,
  OutputFraction,
  Partner,
  TestRun,
  TestRunParameter,
} from "@/lib/project/types";
import { paramMeta, processLine, sortParameters } from "./TestRunsShared";

/**
 * A linked photo, already loaded as a data URL by the caller - the builder is
 * synchronous, so the pictures have to arrive decoded.
 */
export interface ProtocolPhoto {
  name: string;
  dataUrl: string;
  /** Natural pixel size, used to keep the aspect ratio on the page. */
  width: number;
  height: number;
  format: "JPEG" | "PNG";
  capturedAt?: string | null;
}

/** Everything the protocol needs - the caller passes the unfiltered lists. */
export interface ProtocolSources {
  run: TestRun;
  partners: Partner[];
  batches: MaterialBatch[];
  doeSeries: DoeSeries[];
  parameters: TestRunParameter[];
  fractions: OutputFraction[];
  specs: FractionSpec[];
  analyses: FractionAnalysis[];
  results: AnalysisResult[];
  /**
   * Photos linked to the run (documents.linked_to_type = 'test_run'). Plan 5.3
   * requires them in the protocol as patent evidence.
   */
  photos?: ProtocolPhoto[];
}

const MARGIN = 15;
const WIDTH = 180;
const PAGE_BOTTOM = 272;
const LINE = 4.6;
/** Tallest a protocol photo may be drawn, so caption and image share a page. */
const MAX_PHOTO_HEIGHT = 110;

/** jsPDF's standard fonts are WinAnsi - map the typography we use in the UI. */
function s(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  const text = String(value);
  if (!text.length) return "-";
  return text
    .replace(/[–—−]/g, "-")
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/•/g, "-")
    .replace(/·/g, "-")
    .replace(/…/g, "...")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/\u00a0/g, " ")
    .replace(/[^\n\t\u0020-\u00ff]/g, "");
}

function num(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(value);
}

function date(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function dateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function markdownToPlain(markdown: string): string[] {
  return markdown.split("\n").map((line) =>
    line
      .replace(/^\s*#{1,6}\s*/, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^\s*[-*]\s+/, "- "),
  );
}

/**
 * Builds the test run protocol. This document is the patent evidence for the
 * run, so it carries every recorded value - master data, machine parameters,
 * output fractions, analytics with their verdicts and the AI interpretation.
 */
export function buildTestRunProtocolPdf(sources: ProtocolSources): Blob {
  const { run } = sources;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 0;

  const partnerById = new Map(sources.partners.map((partner) => [partner.id, partner]));
  const specById = new Map(sources.specs.map((spec) => [spec.id, spec]));
  const batch = run.input_batch_id
    ? (sources.batches.find((entry) => entry.id === run.input_batch_id) ?? null)
    : null;
  const series = run.doe_series_id
    ? (sources.doeSeries.find((entry) => entry.id === run.doe_series_id) ?? null)
    : null;

  const parameters = sortParameters(
    sources.parameters.filter((param) => param.test_run_id === run.id),
  );
  const fractions = sources.fractions
    .filter((fraction) => fraction.test_run_id === run.id)
    .sort((a, b) => a.fraction_code.localeCompare(b.fraction_code));
  const fractionIds = new Set(fractions.map((fraction) => fraction.id));
  const analyses = sources.analyses
    .filter((analysis) => analysis.output_fraction_id && fractionIds.has(analysis.output_fraction_id))
    .sort((a, b) => a.analysis_code.localeCompare(b.analysis_code));
  const analysisIds = new Set(analyses.map((analysis) => analysis.id));
  const runResults = sources.results.filter((result) => analysisIds.has(result.analysis_id));

  /* ------------------------------------------------------------- primitives */

  const ensure = (height: number) => {
    if (y + height > PAGE_BOTTOM) {
      pdf.addPage();
      y = 22;
    }
  };

  const heading = (text: string) => {
    ensure(14);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(20);
    pdf.text(s(text), MARGIN, y);
    y += 2;
    pdf.setDrawColor(200);
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN, y, MARGIN + WIDTH, y);
    y += 5.5;
  };

  const field = (label: string, value: string) => {
    pdf.setFontSize(9.5);
    const lines = pdf.splitTextToSize(s(value), WIDTH - 48) as string[];
    ensure(lines.length * LINE + 1);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(110);
    pdf.text(s(label), MARGIN, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(20);
    lines.forEach((line, index) => {
      pdf.text(line, MARGIN + 48, y + index * LINE);
    });
    y += lines.length * LINE + 0.8;
  };

  const paragraph = (text: string, indent = 0) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(30);
    const lines = pdf.splitTextToSize(s(text), WIDTH - indent) as string[];
    lines.forEach((line) => {
      ensure(LINE);
      pdf.text(line, MARGIN + indent, y);
      y += LINE;
    });
  };

  const note = (text: string) => {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(9);
    pdf.setTextColor(120);
    const lines = pdf.splitTextToSize(s(text), WIDTH) as string[];
    lines.forEach((line) => {
      ensure(LINE);
      pdf.text(line, MARGIN, y);
      y += LINE;
    });
    pdf.setFont("helvetica", "normal");
  };

  const table = (headers: string[], widths: number[], rows: string[][]) => {
    const cellPadding = 1.6;
    const drawHeader = () => {
      ensure(9);
      pdf.setFillColor(238, 238, 242);
      pdf.rect(MARGIN, y - 4, WIDTH, 6.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(60);
      let x = MARGIN + cellPadding;
      headers.forEach((header, index) => {
        pdf.text(s(header), x, y);
        x += widths[index];
      });
      y += 5.5;
    };

    drawHeader();
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(20);

    rows.forEach((row) => {
      const wrapped = row.map(
        (cell, index) => pdf.splitTextToSize(s(cell), widths[index] - 2 * cellPadding) as string[],
      );
      const height = Math.max(...wrapped.map((lines) => lines.length)) * 4 + 1.6;
      if (y + height > PAGE_BOTTOM) {
        pdf.addPage();
        y = 22;
        drawHeader();
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(20);
      }
      let x = MARGIN + cellPadding;
      wrapped.forEach((lines, index) => {
        lines.forEach((line, lineIndex) => {
          pdf.text(line, x, y + lineIndex * 4);
        });
        x += widths[index];
      });
      y += height;
      pdf.setDrawColor(226);
      pdf.setLineWidth(0.1);
      pdf.line(MARGIN, y - 1.4, MARGIN + WIDTH, y - 1.4);
    });
    y += 3;
  };

  /* ----------------------------------------------------------------- header */

  pdf.setFillColor(109, 40, 217);
  pdf.rect(0, 0, 210, 34, "F");
  pdf.setTextColor(255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("REKUFLOW", MARGIN, 15);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text("Versuchsprotokoll GFK-Aufbereitung", MARGIN, 23);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(s(run.run_code), 210 - MARGIN, 15, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(s(labelOf(TEST_RUN_STATUSES, run.status)), 210 - MARGIN, 22, { align: "right" });

  y = 45;
  pdf.setTextColor(20);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  const titleLines = pdf.splitTextToSize(s(run.title), WIDTH) as string[];
  titleLines.forEach((line) => {
    pdf.text(line, MARGIN, y);
    y += 6.5;
  });
  y += 3;

  /* -------------------------------------------------------------- Stammdaten */

  heading("1. Stammdaten");
  field("Versuchscode", run.run_code);
  field("Titel", run.title);
  field("Status", labelOf(TEST_RUN_STATUSES, run.status));
  field("Prozesslinie", processLine(run.process_line)?.label ?? run.process_line);
  field(
    "Partner / Technikum",
    run.partner_id ? (partnerById.get(run.partner_id)?.name ?? "Unbekannter Partner") : "-",
  );
  field("Maschine", run.machine_name ?? "-");
  field("Maschinentyp", run.machine_type ? labelOf(MACHINE_TYPES, run.machine_type) : "-");
  field("Geplant am", date(run.planned_date));
  field("Durchgefuehrt am", date(run.actual_date));
  field("Verantwortlich", run.responsible ?? "-");
  field(
    "Kosten",
    run.cost_eur === null
      ? "-"
      : new Intl.NumberFormat("de-DE", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(run.cost_eur),
  );
  field(
    "DoE-Plan",
    series
      ? `${series.code} - ${series.name}${run.doe_run_number !== null ? ` (Lauf ${run.doe_run_number})` : ""}`
      : "-",
  );
  field("Angelegt am", dateTime(run.created_at));
  field("Zuletzt geaendert", dateTime(run.updated_at));
  y += 2;

  /* ------------------------------------------------------------ Prozesslinie */

  const line = processLine(run.process_line);
  if (line) {
    heading("2. Prozesskonfiguration");
    field("Ziel", line.goal);
    field("Messer", line.blades);
    field("Schnittspalt", line.gap);
    field("Sieb", line.screen);
    field("Drehzahl", line.rpm);
    field("Kuehlung", line.cooling);
    y += 1;
    note(PROCESS_RULE_OF_THUMB);
    note(
      "Verfahren: kaltmechanische Zerkleinerung durch Scheren/Walken (Low-Impact), kein Prallverfahren.",
    );
    y += 2;
  }

  /* --------------------------------------------------------- Einsatzmaterial */

  heading("3. Einsatzmaterial");
  if (batch) {
    field("Chargencode", batch.batch_code);
    field(
      "Materialklasse",
      `${batch.material_class} - ${labelOf(MATERIAL_CLASSES, batch.material_class)}`,
    );
    field("Harztyp", batch.resin_type ?? "-");
    field("Chargengewicht", `${num(batch.weight_kg, 1)} kg`);
    field(
      "Deklarierter Faseranteil",
      batch.declared_fiber_content_pct === null
        ? "-"
        : `${num(batch.declared_fiber_content_pct, 1)} %`,
    );
    field("Deklarierter Fuellstoff", batch.declared_filler ?? "-");
    field("Stoerstoffe", batch.contamination_notes ?? "-");
    field("Lagerort", batch.storage_location ?? "-");
    field("Chargenstatus", labelOf(BATCH_STATUSES, batch.status));
    field("Wareneingang", date(batch.received_date));
  } else {
    note("Keine Charge zugeordnet.");
  }
  field(
    "Eingesetzte Menge",
    run.input_weight_kg === null ? "-" : `${num(run.input_weight_kg, 1)} kg`,
  );
  y += 2;

  /* ------------------------------------------------------ Maschinenparameter */

  heading("4. Maschinenparameter");
  if (parameters.length) {
    table(
      ["Parameter", "Schluessel", "Wert", "Einheit"],
      [62, 52, 42, 24],
      parameters.map((param) => {
        const meta = paramMeta(param.parameter_key);
        const value =
          param.value_numeric !== null ? num(param.value_numeric, 3) : (param.value_text ?? "-");
        return [meta.label, param.parameter_key, value, param.unit ?? meta.unit ?? "-"];
      }),
    );
  } else {
    note("Keine Maschinenparameter erfasst.");
    y += 2;
  }

  /* ------------------------------------------------------ Ausgangsfraktionen */

  heading("5. Ausgangsfraktionen");
  if (fractions.length) {
    table(
      ["Code", "Zielfraktion", "kg", "Ausbeute", "Rueckstellmuster", "Lagerort", "Status"],
      [30, 38, 20, 20, 26, 26, 20],
      fractions.map((fraction) => [
        fraction.fraction_code,
        fraction.target_fraction_id
          ? `${fraction.target_fraction_id} ${specById.get(fraction.target_fraction_id)?.name ?? ""}`.trim()
          : "-",
        num(fraction.weight_kg, 1),
        fraction.yield_pct === null ? "-" : `${num(fraction.yield_pct, 1)} %`,
        fraction.retained_sample_kg === null ? "-" : `${num(fraction.retained_sample_kg, 2)} kg`,
        fraction.storage_location ?? "-",
        labelOf(FRACTION_STATUSES, fraction.status),
      ]),
    );
    const withNotes = fractions.filter((fraction) => fraction.notes);
    withNotes.forEach((fraction) => {
      paragraph(`${fraction.fraction_code}: ${fraction.notes ?? ""}`, 2);
    });
    if (withNotes.length) y += 2;
  } else {
    note("Keine Ausgangsfraktionen erfasst.");
    y += 2;
  }

  /* ---------------------------------------------------------------- Analytik */

  heading("6. Analytik");
  if (analyses.length) {
    analyses.forEach((analysis) => {
      const fraction = fractions.find((entry) => entry.id === analysis.output_fraction_id) ?? null;
      const spec =
        fraction && fraction.target_fraction_id
          ? (specById.get(fraction.target_fraction_id) ?? null)
          : null;
      const results = sources.results
        .filter((result) => result.analysis_id === analysis.id)
        .sort((a, b) => a.parameter_key.localeCompare(b.parameter_key));

      ensure(16);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(20);
      pdf.text(
        s(
          `${analysis.analysis_code} - ${fraction?.fraction_code ?? "ohne Fraktion"} - ${labelOf(
            ANALYSIS_STATUSES,
            analysis.status,
          )}`,
        ),
        MARGIN,
        y,
      );
      y += 5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(90);
      pdf.text(
        s(
          `Labor: ${
            analysis.lab_partner_id
              ? (partnerById.get(analysis.lab_partner_id)?.name ?? "Unbekannt")
              : "-"
          }   Methode: ${analysis.method ?? "-"}   Probe versandt: ${date(
            analysis.sample_sent_date,
          )}   Ergebnis: ${date(analysis.result_date)}`,
        ),
        MARGIN,
        y,
      );
      y += 5;
      pdf.setTextColor(20);

      if (results.length) {
        table(
          ["Parameter", "Wert", "Einheit", "Soll min", "Soll max", "Bewertung"],
          [52, 24, 20, 24, 24, 36],
          results.map((result) => {
            const verdict = evaluateResult(result, spec);
            const value =
              result.value_numeric !== null ? num(result.value_numeric, 3) : (result.value_text ?? "-");
            return [
              verdict.label,
              value,
              result.unit ?? verdict.unit ?? "-",
              verdict.specMin === null ? "-" : num(verdict.specMin, 2),
              verdict.specMax === null ? "-" : num(verdict.specMax, 2),
              `${CONFORMITY_META[verdict.level].label} (${verdict.note})`,
            ];
          }),
        );
      } else {
        note("Noch keine Messwerte erfasst.");
        y += 2;
      }

      if (analysis.notes) {
        paragraph(`Notiz: ${analysis.notes}`, 2);
        y += 1;
      }
    });
  } else {
    note("Keine Analysen zu diesem Versuch erfasst.");
    y += 2;
  }

  /* ----------------------------------------------------------------- Go/NoGo */

  const breaches = goNoGoBreaches(runResults);
  heading("7. Go / No-Go");
  if (breaches.length) {
    pdf.setTextColor(180, 30, 30);
    breaches.forEach((breach) => paragraph(`- ${breach}`));
    pdf.setTextColor(20);
  } else if (runResults.length) {
    paragraph("Keine Go/No-Go-Verletzung in den vorliegenden Messwerten.");
  } else {
    note("Keine Messwerte vorhanden - Go/No-Go noch nicht bewertbar.");
  }
  y += 3;

  /* ------------------------------------------------------------ Beobachtung */

  heading("8. Beobachtungen / Zusammenfassung");
  if (run.summary) {
    run.summary.split("\n").forEach((paragraphLine) => {
      if (!paragraphLine.trim()) {
        y += 2;
        return;
      }
      paragraph(paragraphLine);
    });
  } else {
    note("Keine Zusammenfassung erfasst.");
  }
  y += 3;

  /* ------------------------------------------------------- KI-Interpretation */

  heading("9. KI-Interpretation");
  if (run.ai_interpretation) {
    note(`Erstellt am ${dateTime(run.ai_interpreted_at)}`);
    y += 1;
    markdownToPlain(run.ai_interpretation).forEach((plainLine) => {
      if (!plainLine.trim()) {
        y += 2;
        return;
      }
      paragraph(plainLine);
    });
  } else {
    note("Keine KI-Interpretation angefordert.");
  }

  /* ------------------------------------------------------ Fotodokumentation */

  const photos = sources.photos;
  y += 3;
  heading("10. Fotodokumentation");
  if (!photos) {
    // The caller did not load the linked pictures (e.g. the list shortcut).
    // Claiming "no photos" here would be a false statement in the evidence.
    note(
      "Fotodokumentation in diesem Export nicht enthalten - das Protokoll aus dem Versuchslauf-Dialog erzeugen, um die verknuepften Fotos einzubetten.",
    );
  } else if (photos.length) {
    note(
      "Fotos aus der Dokumentenablage dieses Versuchslaufs - Nachweis des Materialzustands und der Maschineneinstellung.",
    );
    y += 2;
    photos.forEach((photo, index) => {
      const ratio =
        photo.width > 0 && photo.height > 0 ? photo.height / photo.width : 0.75;
      // Fit into the box without distorting: a portrait photo (ratio > 1) has
      // to lose width, not be squeezed into a landscape rectangle.
      const drawWidth = Math.min(WIDTH, 120, MAX_PHOTO_HEIGHT / ratio);
      const drawHeight = drawWidth * ratio;
      ensure(drawHeight + 10);
      try {
        pdf.addImage(photo.dataUrl, photo.format, MARGIN, y, drawWidth, drawHeight);
      } catch (imageError) {
        // A picture jsPDF refuses must not lose the rest of the protocol.
        console.error("buildTestRunProtocolPdf photo:", imageError);
        note(`Foto ${index + 1} konnte nicht eingebettet werden.`);
        return;
      }
      y += drawHeight + 3.5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(110);
      pdf.text(
        s(
          `Foto ${index + 1}: ${photo.name}${
            photo.capturedAt ? ` (${dateTime(photo.capturedAt)})` : ""
          }`,
        ),
        MARGIN,
        y,
      );
      pdf.setTextColor(20);
      y += 6;
    });
  } else {
    note("Keine Fotos zu diesem Versuchslauf hinterlegt.");
  }

  /* ----------------------------------------------------------------- Footer */

  const created = new Date().toLocaleString("de-DE");
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    if (page > 1) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      pdf.text(s(`${run.run_code} - Versuchsprotokoll`), MARGIN, 12);
      pdf.setDrawColor(220);
      pdf.setLineWidth(0.3);
      pdf.line(MARGIN, 14.5, MARGIN + WIDTH, 14.5);
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(s(`Erstellt am ${created} - RekuFLOW Versuchsprotokoll`), MARGIN, 285);
    pdf.text(`Seite ${page} / ${pageCount}`, MARGIN + WIDTH, 285, { align: "right" });
  }

  return pdf.output("blob");
}

export function protocolFileName(run: TestRun): string {
  const safeCode = run.run_code.replace(/[^A-Za-z0-9_-]+/g, "_");
  return `Versuchsprotokoll_${safeCode}.pdf`;
}
