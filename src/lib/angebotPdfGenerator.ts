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
 * Lädt ein Asset (z. B. Logo) und liefert es als `data:`-URI.
 * Wird vor dem html2canvas-Run benutzt, damit Images im versteckten
 * Render-Container nicht erst über das Netz laden müssen — das ist
 * sonst die Hauptursache für `createPattern`-Fehler („image argument
 * is a canvas element with a width or height of 0").
 */
async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

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

  // Logo vorab als data:URI auflösen und in alle <img class="logo">
  // einsetzen — vermeidet Race-Conditions beim Bild-Laden im versteckten
  // Wrapper, die zu html2canvas-Errors führen.
  const logoDataUri = await fetchAsDataUri('/sirius-logo.png');
  if (logoDataUri) {
    wrapper.querySelectorAll<HTMLImageElement>('img.logo').forEach((img) => {
      img.src = logoDataUri;
    });
  }

  // Auf vollständiges Laden aller Images warten.
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

  // Defensive: Images, die nach dem Wait immer noch 0x0 sind (404,
  // CORS-Block, Decode-Fehler), aus dem DOM entfernen — sonst scheitert
  // html2canvas mit "createPattern ... width or height of 0".
  wrapper.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      console.warn('[Angebot PDF] Removing broken/empty image:', img.src);
      img.remove();
    }
  });

  try {
    const sections = Array.from(
      wrapper.querySelectorAll<HTMLElement>('[data-pdf-page]')
    );
    if (sections.length === 0) {
      throw new Error('No [data-pdf-page] sections found in HTML');
    }

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    // Beim Rendern merken: welche PDF-Page beginnt jede Section?
    // Brauchen wir, um klickbare Link-Annotationen (z. B. SDC-Box auf
    // Seite 4) auf die richtige PDF-Seite zu legen.
    const sectionStartPages: number[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      const canvas = await html2canvas(section, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgHeightMM = (canvas.height * A4_W_MM) / canvas.width;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      if (i > 0) pdf.addPage();
      sectionStartPages.push(pdf.getNumberOfPages());

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

    // Klickbare Link-Annotation für die SDC-Box (auf Seite 4).
    // html2canvas erzeugt nur Bitmaps — Hyperlinks müssen separat per
    // jsPDF angetragen werden, aufbauend auf der Box-Position relativ zur
    // umgebenden Section.
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const link = section.querySelector<HTMLElement>('[data-sdc-link]');
      if (!link) continue;
      const url = (link.getAttribute('href') || '').trim();
      if (!url) continue;

      const sectionRect = section.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      // Eine Section ist im DOM 210mm breit → Conversion-Faktor:
      const pxPerMm = sectionRect.width / A4_W_MM;
      const xMm = (linkRect.left - sectionRect.left) / pxPerMm;
      const yMm = (linkRect.top - sectionRect.top) / pxPerMm;
      const wMm = linkRect.width / pxPerMm;
      const hMm = linkRect.height / pxPerMm;

      // Falls die Section über mehrere PDF-Seiten lief und die Box
      // hinter A4_H_MM liegt, einfach überspringen (Link wäre falsch
      // platziert). Im Normalfall passt Section 4 auf eine Seite.
      if (yMm + hMm > A4_H_MM + 1) {
        console.warn('[Angebot PDF] SDC link overflows page boundary — skipping link annotation');
        continue;
      }

      pdf.setPage(sectionStartPages[i]);
      pdf.link(xMm, yMm, wMm, hMm, { url });
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
