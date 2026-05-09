import type { Zusatzvereinbarungen } from '@/components/angebot/ZusatzvereinbarungenCard';
import { buildAngebotHtml } from './angebotPreviewHtml';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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

const A4_W_MM = 210;
const A4_H_MM = 297;

/**
 * PDF-Export. Rendert exakt das Vorschau-HTML — pro `[data-pdf-page]`-
 * Section ein eigenes Canvas → eine eigene PDF-Seite. Damit gibt's
 * keine zerschnittenen Tabellen, und Anschreiben/Geräte/Zusatz/Kontakte
 * landen jeweils auf ihrer eigenen Seite. Footer + „Seite X von Y"
 * werden nach allen Renders über jede PDF-Seite drüber gemalt.
 */
export async function generateAngebotPdf(input: PdfInput): Promise<Blob> {
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

  // Body-Inhalt + Styles aus dem HTML extrahieren — wir packen das
  // in einen versteckten Container im aktuellen DOM, sonst kann
  // html2canvas die Schriften / Bilder nicht resolved kriegen.
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const styleTags = Array.from(doc.querySelectorAll('style'))
    .map((s) => s.outerHTML)
    .join('\n');
  const bodyHtml = doc.body.innerHTML;

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

  // Bilder (Logo!) laden lassen, sonst rendert html2canvas leere Boxen.
  await Promise.all(
    Array.from(wrapper.querySelectorAll('img')).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );

  try {
    const sections = Array.from(
      wrapper.querySelectorAll<HTMLElement>('[data-pdf-page]')
    );
    if (sections.length === 0) {
      throw new Error('No [data-pdf-page] sections found in HTML');
    }

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      const canvas = await html2canvas(section, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      // Scale nach A4-Breite, Höhe ergibt sich proportional.
      const imgHeightMM = (canvas.height * A4_W_MM) / canvas.width;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      if (i > 0) pdf.addPage();

      // Wenn der Section-Content höher als A4 ist (z. B. sehr viele
      // Geräte oder Zusatz-Items): über mehrere PDF-Seiten splitten,
      // damit nichts abgeschnitten wird.
      if (imgHeightMM <= A4_H_MM + 0.5) {
        pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, imgHeightMM);
      } else {
        let heightLeft = imgHeightMM;
        let position = 0;
        pdf.addImage(imgData, 'JPEG', 0, position, A4_W_MM, imgHeightMM);
        heightLeft -= A4_H_MM;
        while (heightLeft > 0) {
          position -= A4_H_MM;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, A4_W_MM, imgHeightMM);
          heightLeft -= A4_H_MM;
        }
      }
    }

    // „Seite X von Y" auf jeder PDF-Seite unten rechts überlegen.
    const pageCount = pdf.getNumberOfPages();
    pdf.setFont('helvetica', 'normal');
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`Seite ${i} von ${pageCount}`, A4_W_MM - 12, A4_H_MM - 6, { align: 'right' });
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(wrapper);
  }
}
