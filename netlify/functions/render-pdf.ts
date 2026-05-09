import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

/**
 * Rendert HTML zu echtem Vector-PDF via Headless-Chromium.
 * Gegenstück zur ehemaligen html2canvas-Bitmap-Variante — Schrift bleibt
 * Vektor (durchsuchbar, scharf bei jedem Zoom), Hyperlinks bleiben aktiv,
 * `page-break-after`-CSS wird nativ respektiert.
 *
 * POST { html: string } → application/pdf
 */
export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let html: string | undefined;
  try {
    const body = await req.json();
    html = body?.html;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!html || typeof html !== 'string') {
    return new Response('Missing html', { status: 400 });
  }

  let browser: any = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 2 }, // A4 @ 96dpi
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });

    // Puppeteer-Footer mit "Seite X von Y" — auf jeder PDF-Seite identisch.
    // Wichtig: explizite font-size, sonst rendert Chromium den Footer mit 0px.
    const footerTemplate = `
      <div style="font-size: 7.5px; color: #94A3B8; width: 100%; padding: 0 12mm; line-height: 1.5; letter-spacing: 0.01em; text-align: center; font-family: 'Inter', 'Segoe UI', sans-serif;">
        SIRIUS GmbH document solutions · Abrichstr. 23 · 79108 Freiburg ·
        Geschäftsführer: Fabian Schüler, Michael Wangerowski, Manfred Schüler ·
        Registergericht: Amtsgericht Freiburg · HRB 2624
        <br/>
        Seite <span class="pageNumber"></span> von <span class="totalPages"></span>
      </div>`;

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate,
      margin: { top: '0', right: '0', bottom: '15mm', left: '0' },
    });

    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[render-pdf] error', err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
};

export const config = {
  // Chromium braucht Memory + Zeit, Function bewusst ausreichend bemessen
  schedule: undefined,
};
