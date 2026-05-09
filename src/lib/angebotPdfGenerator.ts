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
 * Lädt ein Asset (Logo) und liefert es als `data:`-URI. Wird ins HTML
 * eingebettet, damit der Server-Renderer keinen URL-Roundtrip auf
 * `/sirius-logo.png` braucht (im Server-Kontext oft nicht erreichbar).
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
 * PDF-Export. Schickt das vollständige Vorschau-HTML an die
 * Netlify-Function `render-pdf`, die mit Headless-Chromium ein
 * echtes Vector-PDF erzeugt.
 *
 * Vorteile gegenüber der vorherigen html2canvas-Variante:
 *   - Vector-Text (durchsuchbar, scharf bei jedem Zoom)
 *   - Hyperlinks bleiben automatisch erhalten (keine pdf.link()-Tricks)
 *   - CSS `page-break-after`/`@page` wird nativ respektiert
 *   - Schriftrendering identisch zur Browser-Vorschau
 */
export async function generateAngebotPdf(input: PdfInput): Promise<Blob> {
  // Logo als data:URI vorab laden — der Server hat keinen Zugang zur
  // App-URL. Beim Vorschau-Build ist das Asset zudem noch nicht im CDN.
  const logoDataUri = await fetchAsDataUri('/sirius-logo.png');

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
    { forPdf: true, logoDataUri: logoDataUri || undefined },
  );

  const res = await fetch('/.netlify/functions/render-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ html }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const txt = await res.text();
      detail = txt.slice(0, 400);
    } catch { /* ignore */ }
    throw new Error(`PDF-Render fehlgeschlagen (${res.status}): ${detail}`);
  }

  return await res.blob();
}
