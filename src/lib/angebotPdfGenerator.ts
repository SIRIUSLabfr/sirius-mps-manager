import type { Zusatzvereinbarungen } from '@/components/angebot/ZusatzvereinbarungenCard';
import { buildAngebotHtml } from './angebotPreviewHtml';

interface PdfInput {
  projectName: string;
  projectId: string;
  calcData: {
    finance_type: string;
    term_months: number;
    total_monthly_rate: number;
    total_hardware_ek: number;
    service_rate: number;
    config_json: any;
  };
  zusatz: Zusatzvereinbarungen;
  showPrices?: boolean;
  customerName?: string;
  contactPerson?: string;
  customerAddress?: string;
  customerNumber?: string;
  angebotNumber?: string;
  ansprechpartner?: { name: string; role?: string; email?: string; phone?: string } | null;
}

/**
 * PDF-Export des Angebots. Rendert exakt dasselbe HTML, das die
 * Vorschau (`AngebotPreviewDialog`) anzeigt — Single Source of Truth
 * via `buildAngebotHtml`.
 *
 * Strategie: HTML in einem versteckten Container rendern, mit
 * html2canvas einmal komplett zur Bitmap machen, in A4-große Slices
 * schneiden und Slice für Slice als eigene PDF-Seite einfügen.
 */
export async function generateAngebotPdf(input: PdfInput): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  const html = buildAngebotHtml(
    {
      projectName: input.projectName,
      customerName: input.customerName,
      customerNumber: input.customerNumber,
      customerAddress: input.customerAddress,
      contactPerson: input.contactPerson,
      angebotNumber: input.angebotNumber,
      ansprechpartner: input.ansprechpartner,
      calcData: input.calcData,
      zusatz: input.zusatz,
    },
    { forPdf: true }
  );

  // Wir brauchen aus dem kompletten <html>…</html>-String nur den Body-
  // Inhalt + Styles, damit er in unserem Render-Container lebt.
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const styleTags = Array.from(doc.querySelectorAll('style'))
    .map((s) => s.outerHTML)
    .join('\n');
  const bodyHtml = doc.body.innerHTML;

  // Hidden render container, A4 breit (210 mm)
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.width = '210mm';
  wrapper.style.opacity = '0';
  wrapper.style.zIndex = '-9999';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.background = '#ffffff';
  wrapper.innerHTML = `${styleTags}<div id="pdf-root" style="width:210mm;background:#fff;">${bodyHtml}</div>`;
  document.body.appendChild(wrapper);

  // Bilder fertig laden lassen
  const images = wrapper.querySelectorAll('img');
  await Promise.all(
    Array.from(images).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );

  const root = wrapper.querySelector('#pdf-root') as HTMLElement;

  try {
    const canvas = await html2canvas(root, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const A4_W_MM = 210;
    const A4_H_MM = 297;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    // Bildhöhe in mm bei voller A4-Breite
    const pdfImgHeightMM = (canvas.height * A4_W_MM) / canvas.width;

    // Slice-Strategie: Eine einzige hohe Bitmap, pro PDF-Seite den
    // sichtbaren Ausschnitt per negativem Y-Offset platzieren.
    let heightLeft = pdfImgHeightMM;
    let position = 0;
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    pdf.addImage(imgData, 'JPEG', 0, position, A4_W_MM, pdfImgHeightMM);
    heightLeft -= A4_H_MM;

    while (heightLeft > 0) {
      position -= A4_H_MM;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, A4_W_MM, pdfImgHeightMM);
      heightLeft -= A4_H_MM;
    }

    // Seitenzahlen
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`Seite ${i} von ${pageCount}`, A4_W_MM - 15, A4_H_MM - 8, { align: 'right' });
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(wrapper);
  }
}
