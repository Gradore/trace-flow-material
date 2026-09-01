import jsPDF from 'jspdf';
import { generateQRCodeDataURL } from './qrcode';

interface LabelData {
  id: string;
  type: string;
  material?: string;
  weight?: string;
  location?: string;
  batch?: string;
  partner?: string;
  date: string;
}

export interface TraceabilityEventData {
  label: string;
  description: string;
  date: string;
  details?: string;
}

export interface TraceabilityReportData {
  inputId: string;
  material: string;
  supplier: string;
  weight: string;
  status: string;
  containerId?: string;
  samplesCount: number;
  createdAt: string;
}

interface DeliveryNoteData {
  noteId: string;
  type: 'incoming' | 'outgoing';
  date: string;
  partner: string;
  material: string;
  batchNumber?: string;
  weight: string;
  wasteCode?: string;
}

/**
 * Generate a container/material label PDF with QR code
 */
export async function generateLabelPDF(data: LabelData, qrUrl: string): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [100, 60], // Label size: 100mm x 60mm
  });

  // Generate QR code
  const qrCodeDataUrl = await generateQRCodeDataURL(qrUrl, { width: 150 });

  // Header
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text('RECYTRACK', 5, 6);

  // ID (large)
  pdf.setFontSize(16);
  pdf.setTextColor(0);
  pdf.setFont('helvetica', 'bold');
  pdf.text(data.id, 5, 16);

  // Type badge
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.type, 5, 23);

  // Details
  pdf.setFontSize(9);
  let yPos = 30;

  if (data.material) {
    pdf.text(`Material: ${data.material}`, 5, yPos);
    yPos += 5;
  }

  if (data.weight) {
    pdf.text(`Gewicht: ${data.weight}`, 5, yPos);
    yPos += 5;
  }

  if (data.location) {
    pdf.text(`Standort: ${data.location}`, 5, yPos);
    yPos += 5;
  }

  if (data.batch) {
    pdf.text(`Charge: ${data.batch}`, 5, yPos);
    yPos += 5;
  }

  if (data.partner) {
    pdf.text(`Partner: ${data.partner}`, 5, yPos);
    yPos += 5;
  }

  // Date
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text(`Erstellt: ${data.date}`, 5, 55);

  // QR Code
  pdf.addImage(qrCodeDataUrl, 'PNG', 65, 8, 30, 30);

  // QR label
  pdf.setFontSize(7);
  pdf.text('Scannen für Details', 65, 42);

  return pdf.output('blob');
}

/**
 * Generate a delivery note PDF
 */
export async function generateDeliveryNotePDF(data: DeliveryNoteData, qrUrl: string): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Generate QR code
  const qrCodeDataUrl = await generateQRCodeDataURL(qrUrl, { width: 200 });

  // Header
  pdf.setFillColor(16, 185, 129); // Primary green
  pdf.rect(0, 0, 210, 35, 'F');

  pdf.setTextColor(255);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RECYTRACK', 15, 20);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Materialverfolgung', 15, 28);

  // Document title
  pdf.setTextColor(0);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  const title = data.type === 'incoming' ? 'EINGANGS-LIEFERSCHEIN' : 'AUSGANGS-LIEFERSCHEIN';
  pdf.text(title, 15, 50);

  // Document ID
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.noteId, 15, 58);

  // QR Code
  pdf.addImage(qrCodeDataUrl, 'PNG', 150, 42, 40, 40);

  // Separator line
  pdf.setDrawColor(200);
  pdf.line(15, 90, 195, 90);

  // Document details
  pdf.setFontSize(11);
  let yPos = 105;

  const addField = (label: string, value: string) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(100);
    pdf.text(label, 15, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0);
    pdf.text(value, 70, yPos);
    yPos += 10;
  };

  addField('Datum:', data.date);
  addField('Art:', data.type === 'incoming' ? 'Eingang' : 'Ausgang');
  addField(data.type === 'incoming' ? 'Lieferant:' : 'Kunde:', data.partner);
  addField('Material:', data.material);
  if (data.batchNumber) {
    addField('Charge:', data.batchNumber);
  }
  addField('Gewicht:', data.weight);
  if (data.wasteCode) {
    addField('Abfallschlüssel:', data.wasteCode);
  }

  // Separator line
  yPos += 10;
  pdf.setDrawColor(200);
  pdf.line(15, yPos, 195, yPos);
  yPos += 15;

  // Signatures section
  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text('Unterschrift Absender:', 15, yPos);
  pdf.text('Unterschrift Empfänger:', 110, yPos);

  yPos += 25;
  pdf.line(15, yPos, 90, yPos);
  pdf.line(110, yPos, 185, yPos);

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(150);
  pdf.text('Erstellt mit RekuFLOW - Materialverfolgung für die Recyclingbranche', 15, 280);
  pdf.text(`Erstellt am: ${new Date().toLocaleString('de-DE')}`, 15, 285);

  return pdf.output('blob');
}

/**
 * Generate a traceability report PDF for a material input and its timeline
 */
export async function generateTraceabilityPDF(
  data: TraceabilityReportData,
  events: TraceabilityEventData[],
  qrUrl: string
): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const qrCodeDataUrl = await generateQRCodeDataURL(qrUrl, { width: 200 });

  // Header
  pdf.setFillColor(16, 185, 129); // Primary green
  pdf.rect(0, 0, 210, 35, 'F');

  pdf.setTextColor(255);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RECYTRACK', 15, 20);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Materialverfolgung', 15, 28);

  // Document title
  pdf.setTextColor(0);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('MATERIAL-RÜCKVERFOLGUNG', 15, 50);

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.inputId, 15, 58);

  // QR Code
  pdf.addImage(qrCodeDataUrl, 'PNG', 150, 42, 40, 40);

  pdf.setDrawColor(200);
  pdf.line(15, 90, 195, 90);

  // Master data
  let yPos = 102;

  const addField = (label: string, value: string) => {
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(100);
    pdf.text(label, 15, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0);
    pdf.text(value, 70, yPos);
    yPos += 8;
  };

  addField('Eingangsdatum:', data.createdAt);
  addField('Material:', data.material);
  addField('Lieferant:', data.supplier);
  addField('Gewicht:', data.weight);
  addField('Status:', data.status);
  addField('Container:', data.containerId || '-');
  addField('Proben:', String(data.samplesCount));

  yPos += 4;
  pdf.setDrawColor(200);
  pdf.line(15, yPos, 195, yPos);
  yPos += 12;

  // Timeline
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0);
  pdf.text('Materialfluss-Timeline', 15, yPos);
  yPos += 10;

  const newPageIfNeeded = (needed: number) => {
    if (yPos + needed <= 270) return;
    pdf.addPage();
    yPos = 25;
  };

  if (events.length === 0) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100);
    pdf.text('Für diesen Materialeingang wurden noch keine Ereignisse protokolliert.', 15, yPos);
    yPos += 8;
  } else {
    events.forEach((event) => {
      newPageIfNeeded(20);

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0);
      pdf.text(event.label, 15, yPos);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100);
      pdf.text(event.date, 195, yPos, { align: 'right' });
      yPos += 5;

      pdf.setTextColor(0);
      pdf.splitTextToSize(event.description, 180).forEach((line: string) => {
        newPageIfNeeded(6);
        pdf.text(line, 15, yPos);
        yPos += 5;
      });

      if (event.details) {
        pdf.setFontSize(8);
        pdf.setTextColor(120);
        pdf.splitTextToSize(event.details, 180).forEach((line: string) => {
          newPageIfNeeded(5);
          pdf.text(line, 15, yPos);
          yPos += 4;
        });
        pdf.setFontSize(10);
      }

      yPos += 4;
    });
  }

  // Footer on every page
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(150);
    pdf.text('Erstellt mit RekuFLOW - Materialverfolgung für die Recyclingbranche', 15, 285);
    pdf.text(
      `Erstellt am: ${new Date().toLocaleString('de-DE')} - Seite ${page} von ${pageCount}`,
      15,
      290
    );
  }

  return pdf.output('blob');
}

/**
 * Download a PDF blob
 */
export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Open a PDF in a new tab for printing.
 *
 * Returns false when the browser blocked the popup - the caller must not report
 * success in that case, because nothing was opened and nothing was printed.
 */
export function printPDF(blob: Blob): boolean {
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');

  if (!printWindow) {
    URL.revokeObjectURL(url);
    return false;
  }

  printWindow.onload = () => {
    printWindow.print();
  };

  return true;
}
