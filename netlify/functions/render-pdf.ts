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

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true,
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
