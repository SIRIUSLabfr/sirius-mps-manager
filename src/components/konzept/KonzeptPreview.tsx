import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, Loader2 } from 'lucide-react';
import type { ConceptConfig } from '@/hooks/useConceptData';
import type { Tables } from '@/integrations/supabase/types';
import { formatDate, formatCurrency } from '@/lib/constants';
import { toast } from 'sonner';

interface Props {
  config: ConceptConfig;
  project: Tables<'projects'>;
  devices: Tables<'devices'>[];
  locations: Tables<'locations'>[];
  calculation: Tables<'calculations'> | null;
  itConfig: Tables<'it_config'> | null;
}

function buildLocationStr(d: Tables<'devices'>) {
  return [d.ist_building, d.ist_floor, d.ist_room].filter(Boolean).join(', ');
}

const PDF_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Roboto:wght@300;400;500&display=swap');
*{box-sizing:border-box}
body{font-family:'Roboto',sans-serif;margin:0;padding:0;color:#1a2744;font-size:12px;line-height:1.6}
h1,h2,h3{font-family:'Montserrat',sans-serif;color:#003da5;margin:0}
.page{page-break-before:always;padding:60px 50px 80px 50px;position:relative;min-height:297mm}
.page:first-child{page-break-before:avoid}
.page-header{position:running(header);font-family:'Montserrat',sans-serif;font-size:8px;color:#8899aa;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #dde3ed;padding-bottom:6px;margin-bottom:24px}
.page-footer{font-family:'Roboto',sans-serif;font-size:8px;color:#99aabb;text-align:center;position:absolute;bottom:30px;left:50px;right:50px;border-top:1px solid #eef2f7;padding-top:6px}
.cover{display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:calc(297mm - 120px);text-align:center;padding:60px 50px}
.cover .logo-area{margin-bottom:80px}
.cover .logo-text{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#003da5}
.cover .logo-sub{font-family:'Montserrat',sans-serif;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#00a3e0;margin-top:2px}
.cover h1{font-size:32px;font-weight:800;color:#003da5;margin-bottom:8px}
.cover .customer{font-size:20px;font-weight:600;color:#1a2744;margin-bottom:4px}
.cover .meta{font-size:11px;color:#667788;margin-top:40px}
.cover .meta p{margin:4px 0}
.cover .line{width:80px;height:3px;background:linear-gradient(90deg,#003da5,#00a3e0);border-radius:2px;margin:24px auto}
h2.section-title{font-size:16px;font-weight:700;color:#003da5;border-bottom:2px solid #00a3e0;padding-bottom:6px;margin:0 0 16px 0}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:11px}
th{background:#003da5;color:white;font-family:'Montserrat',sans-serif;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:.5px;padding:8px 10px;text-align:left}
td{padding:6px 10px;border-bottom:1px solid #eef2f7}
tr:nth-child(even) td{background:#f8fafc}
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}
.stat-box{padding:14px;border-radius:6px;background:#f0f4fa}
.stat-box .label{font-family:'Montserrat',sans-serif;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#667788;margin-bottom:4px}
.stat-box .value{font-size:14px;font-weight:600;color:#1a2744}
.stat-box.highlight{background:#003da5;grid-column:span 2}
.stat-box.highlight .label{color:rgba(255,255,255,0.7)}
.stat-box.highlight .value{color:white;font-size:20px}
.contact-box{border:1px solid #dde3ed;border-radius:6px;padding:16px;margin:8px 0}
.contact-box .title{font-family:'Montserrat',sans-serif;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#667788;margin-bottom:6px}
.contact-box .name{font-size:13px;font-weight:600;color:#1a2744}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:600}
.badge-1to1{background:#dbeafe;color:#1e40af}
.badge-upgrade{background:#dcfce7;color:#166534}
.badge-keep{background:#f0f4fa;color:#667788}
.badge-remove{background:#fee2e2;color:#991b1b}
.whitespace-pre{white-space:pre-line}
.text-muted{color:#667788;font-size:11px}
@media print{
  .page{page-break-before:always;padding:40px}
  .page:first-child{page-break-before:avoid}
  .no-print{display:none!important}
}
`;

function buildPdfHtml(props: Props): string {
  const { config, project, devices, locations, calculation, itConfig } = props;
  const customerName = config.overrides.customer_name || project.customer_name;
  const projectNumber = config.overrides.project_number || project.project_number || '';
  const contactSirius = config.overrides.contact_sirius || '';
  const contactCustomer = config.overrides.contact_customer || '';
  const dateStr = config.overrides.date || new Date().toISOString().slice(0, 10);
  const formattedDate = formatDate(dateStr);
  const todayStr = formatDate(new Date().toISOString().slice(0, 10));

  const istDevices = devices.filter(d => d.ist_model);
  const sollDevices = devices.filter(d => d.soll_model);
  const sites = locations.filter(l => l.location_type === 'site');

  const istGrouped = groupBy(istDevices, d => `${d.ist_manufacturer}|${d.ist_model}|${buildLocationStr(d)}`);
  const sollGrouped = groupBy(sollDevices, d => `${d.soll_manufacturer}|${d.soll_model}|${[d.soll_building, d.soll_floor, d.soll_room].filter(Boolean).join(', ')}`);

  const headerHtml = `<div class="page-header"><span>SIRIUS document solutions | MPS Konzept</span><span>Seite</span></div>`;
  const footerHtml = `<div class="page-footer">Vertraulich – erstellt am ${todayStr}</div>`;

  let pages: string[] = [];

  // Cover
  pages.push(`<div class="cover">
    <div class="logo-area">
      <div class="logo-text">SIRIUS ⭐ document solutions</div>
      <div class="logo-sub">Managed Print Services</div>
    </div>
    <h1>MPS Konzept</h1>
    <div class="line"></div>
    <div class="customer">${customerName}</div>
    ${projectNumber ? `<p style="color:#667788;font-size:12px">Projekt ${projectNumber}</p>` : ''}
    <div class="meta">
      <p>${formattedDate}</p>
      ${contactSirius ? `<p>Erstellt von: ${contactSirius}</p>` : ''}
    </div>
    ${footerHtml}
  </div>`);

  // Einleitung
  if (config.texts.einleitung) {
    pages.push(`<div class="page">${headerHtml}
      <h2 class="section-title">Einleitung</h2>
      <p class="whitespace-pre" style="color:#445566">${config.texts.einleitung}</p>
      ${footerHtml}</div>`);
  }

  // IST Analyse
  if (config.blocks.ist_analyse && istDevices.length > 0) {
    const rows = Object.entries(istGrouped).map(([, items]) => {
      const f = items[0];
      return `<tr><td>${buildLocationStr(f) || '–'}</td><td>${f.ist_manufacturer || '–'}</td><td>${f.ist_model}</td><td style="text-align:right">${items.length}</td></tr>`;
    }).join('');
    pages.push(`<div class="page">${headerHtml}
      <h2 class="section-title">Ausgangssituation / IST-Analyse</h2>
      <p class="text-muted" style="margin-bottom:12px">Aktuell betreiben Sie <strong style="color:#1a2744">${istDevices.length} Geräte</strong> an <strong style="color:#1a2744">${sites.length} Standort${sites.length !== 1 ? 'en' : ''}</strong>.</p>
      <table><thead><tr><th>Standort</th><th>Hersteller</th><th>Modell</th><th style="text-align:right">Anzahl</th></tr></thead><tbody>${rows}</tbody></table>
      ${footerHtml}</div>`);
  }

  // SOLL Konzept
  if (config.blocks.soll_konzept && sollDevices.length > 0) {
    const diffText = istDevices.length > 0
      ? ` – eine ${sollDevices.length < istDevices.length ? 'Optimierung' : 'Anpassung'} um <strong style="color:#1a2744">${Math.abs(istDevices.length - sollDevices.length)} Geräte</strong>`
      : '';
    const rows = Object.entries(sollGrouped).map(([, items]) => {
      const f = items[0];
      const loc = [f.soll_building, f.soll_floor, f.soll_room].filter(Boolean).join(', ') || buildLocationStr(f) || '–';
      return `<tr><td>${loc}</td><td>${f.soll_manufacturer || '–'}</td><td>${f.soll_model}</td><td style="text-align:right">${items.length}</td></tr>`;
    }).join('');
    pages.push(`<div class="page">${headerHtml}
      <h2 class="section-title">SOLL-Konzept / Neue Geräteflotte</h2>
      <p class="text-muted" style="margin-bottom:12px">Das neue Konzept sieht <strong style="color:#1a2744">${sollDevices.length} Geräte</strong> vor${diffText}.</p>
      <table><thead><tr><th>Standort</th><th>Hersteller</th><th>Modell</th><th style="text-align:right">Anzahl</th></tr></thead><tbody>${rows}</tbody></table>
      ${footerHtml}</div>`);
  }

  // IST-SOLL Vergleich
  if (config.blocks.ist_soll_vergleich && devices.some(d => d.ist_model && d.soll_model)) {
    const rows = devices.filter(d => d.ist_model || d.soll_model).map(d => {
      const optClass = d.optimization_type === 'OneToOne' ? 'badge-1to1' : d.optimization_type === 'Keep' ? 'badge-keep' : d.optimization_type === 'Abbau' ? 'badge-remove' : 'badge-upgrade';
      return `<tr><td>${buildLocationStr(d) || '–'}</td><td>${(d.ist_manufacturer || '')} ${d.ist_model || '–'}</td><td>${(d.soll_manufacturer || '')} ${d.soll_model || '–'}</td><td>${d.optimization_type ? `<span class="badge ${optClass}">${d.optimization_type}</span>` : ''}</td></tr>`;
    }).join('');
    pages.push(`<div class="page">${headerHtml}
      <h2 class="section-title">IST-SOLL Vergleich</h2>
      <table><thead><tr><th>Standort</th><th>IST Gerät</th><th>SOLL Gerät</th><th>Optimierung</th></tr></thead><tbody>${rows}</tbody></table>
      ${footerHtml}</div>`);
  }

  // Standortübersicht
  if (config.blocks.standortuebersicht && sites.length > 0) {
    const rows = sites.map(loc => {
      const cnt = devices.filter(d => d.location_id === loc.id).length;
      return `<tr><td style="font-weight:500">${loc.name}</td><td>${[loc.address_street, loc.address_zip, loc.address_city].filter(Boolean).join(', ') || '–'}</td><td style="text-align:right">${cnt}</td></tr>`;
    }).join('');
    pages.push(`<div class="page">${headerHtml}
      <h2 class="section-title">Standortübersicht</h2>
      <table><thead><tr><th>Standort</th><th>Adresse</th><th style="text-align:right">Geräte</th></tr></thead><tbody>${rows}</tbody></table>
      ${footerHtml}</div>`);
  }

  // Finanzierung
  if (config.blocks.finanzierung && calculation) {
    const finType = calculation.finance_type === 'leasing' ? 'Leasing' : calculation.finance_type === 'miete' ? 'Miete' : calculation.finance_type || '–';
    pages.push(`<div class="page">${headerHtml}
      <h2 class="section-title">Finanzierung & Kosten</h2>
      <div class="stat-grid">
        <div class="stat-box"><div class="label">Finanzierungsart</div><div class="value">${finType}</div></div>
        <div class="stat-box"><div class="label">Laufzeit</div><div class="value">${calculation.term_months || 60} Monate</div></div>
        <div class="stat-box highlight"><div class="label">Monatliche Gesamtrate</div><div class="value">${formatCurrency(calculation.total_monthly_rate)}</div></div>
      </div>
      <p class="text-muted" style="margin-top:16px">Inkl. Hardware, Service, Verbrauchsmaterial und Wartung. Alle Preise zzgl. MwSt.</p>
      ${footerHtml}</div>`);
  }

  // Rollout-Zeitplan
  if (config.blocks.rollout_zeitplan && (project.rollout_start || project.rollout_end)) {
    pages.push(`<div class="page">${headerHtml}
      <h2 class="section-title">Rollout-Zeitplan</h2>
      <div class="stat-grid">
        <div class="stat-box"><div class="label">Start</div><div class="value">${formatDate(project.rollout_start)}</div></div>
        <div class="stat-box"><div class="label">Ende</div><div class="value">${formatDate(project.rollout_end)}</div></div>
      </div>
      <p class="text-muted" style="margin-top:12px">Phasen: Vorbereitung → Auslieferung & Installation → Endkontrolle</p>
      ${footerHtml}</div>`);
  }

  // IT-Konzept
  if (config.blocks.it_konzept && itConfig) {
    let items = '';
    if (itConfig.scan_methods?.length) items += `<div class="stat-box"><div class="label">Scan-Methoden</div><div class="value">${itConfig.scan_methods.join(', ')}</div></div>`;
    if (itConfig.software_followme_system) items += `<div class="stat-box"><div class="label">Follow-Me System</div><div class="value">${itConfig.software_followme_system}</div></div>`;
    if (itConfig.software_fleet_server) items += `<div class="stat-box"><div class="label">Fleet Management</div><div class="value">${itConfig.software_fleet_server}</div></div>`;
    if (itConfig.training_type?.length) items += `<div class="stat-box"><div class="label">Einweisung</div><div class="value">${itConfig.training_type.join(', ')}</div></div>`;
    if (items) {
      pages.push(`<div class="page">${headerHtml}
        <h2 class="section-title">IT-Konzept</h2>
        <div class="stat-grid">${items}</div>
        ${footerHtml}</div>`);
    }
  }

  // Abschluss + Ansprechpartner (combined on last page)
  const hasAbschluss = !!config.texts.abschluss;
  const hasContacts = config.blocks.ansprechpartner && (contactSirius || contactCustomer);
  const hasAnmerkungen = !!config.texts.anmerkungen;
  if (hasAbschluss || hasContacts || hasAnmerkungen) {
    let content = headerHtml;
    if (hasAbschluss) {
      content += `<h2 class="section-title">Zusammenfassung</h2><p class="whitespace-pre" style="color:#445566;margin-bottom:24px">${config.texts.abschluss}</p>`;
    }
    if (hasContacts) {
      content += `<h2 class="section-title" style="margin-top:24px">Ansprechpartner & Kontakt</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">`;
      if (contactSirius) content += `<div class="contact-box"><div class="title">SIRIUS document solutions</div><div class="name">${contactSirius}</div></div>`;
      if (contactCustomer) content += `<div class="contact-box"><div class="title">${customerName}</div><div class="name">${contactCustomer}</div></div>`;
      content += `</div>`;
    }
    if (hasAnmerkungen) {
      content += `<p style="margin-top:24px;padding-top:12px;border-top:1px solid #eef2f7;font-style:italic;color:#667788;font-size:10px" class="whitespace-pre">${config.texts.anmerkungen}</p>`;
    }
    content += footerHtml;
    pages.push(`<div class="page">${content}</div>`);
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PDF_STYLES}</style></head><body>${pages.join('')}</body></html>`;
}

export default function KonzeptPreview(props: Props) {
  const { config, project, devices, locations, calculation, itConfig } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const customerName = config.overrides.customer_name || project.customer_name;
  const projectNumber = config.overrides.project_number || project.project_number || '';
  const contactSirius = config.overrides.contact_sirius || '';
  const contactCustomer = config.overrides.contact_customer || '';
  const dateStr = config.overrides.date || new Date().toISOString().slice(0, 10);

  const istDevices = devices.filter(d => d.ist_model);
  const sollDevices = devices.filter(d => d.soll_model);
  const sites = locations.filter(l => l.location_type === 'site');

  const istGrouped = groupBy(istDevices, d => `${d.ist_manufacturer}|${d.ist_model}|${buildLocationStr(d)}`);
  const sollGrouped = groupBy(sollDevices, d => `${d.soll_manufacturer}|${d.soll_model}|${buildLocationStr(d)}`);

  const handlePrint = () => {
    const html = buildPdfHtml(props);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const handleDownloadPdf = async () => {
    setGenerating(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      // Create a temporary container with the PDF HTML
      const container = document.createElement('div');
      const html = buildPdfHtml(props);
      // Extract body content
      const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
      container.innerHTML = bodyMatch?.[1] || '';

      // Apply styles
      const styleEl = document.createElement('style');
      styleEl.textContent = PDF_STYLES;
      container.prepend(styleEl);
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      await html2pdf().set({
        margin: 0,
        filename: `MPS_Konzept_${customerName.replace(/\s+/g, '_')}_${dateStr}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css'] },
      }).from(container).save();

      document.body.removeChild(container);
      toast.success('PDF wurde heruntergeladen');
    } catch (err) {
      console.error(err);
      toast.error('Fehler bei der PDF-Erstellung');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 no-print">
        <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
          <Printer className="h-4 w-4" /> Drucken
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadPdf} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          PDF herunterladen
        </Button>
      </div>

      <div ref={ref} className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {/* Cover page */}
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center border-b border-border">
          <p className="text-xs font-heading font-bold tracking-[3px] uppercase text-primary mb-1">
            SIRIUS ⭐ document solutions
          </p>
          <p className="text-[10px] font-heading tracking-[2px] uppercase text-muted-foreground mb-12">
            Managed Print Services
          </p>
          <h1 className="text-3xl font-heading font-extrabold text-primary mb-2">MPS Konzept</h1>
          <div className="w-20 h-[3px] bg-gradient-to-r from-primary to-secondary rounded-full mb-6" />
          <p className="text-lg font-heading font-semibold text-foreground mb-1">{customerName}</p>
          {projectNumber && <p className="text-sm text-muted-foreground">Projekt {projectNumber}</p>}
          <p className="text-sm text-muted-foreground mt-6">{formatDate(dateStr)}</p>
          {contactSirius && <p className="text-xs text-muted-foreground mt-2">Erstellt von: {contactSirius}</p>}
        </div>

        <div className="p-8 space-y-8 text-sm">
          {/* Einleitung */}
          {config.texts.einleitung && (
            <section>
              <h2 className="text-lg font-heading font-bold text-primary border-b-2 border-secondary pb-1 mb-3">Einleitung</h2>
              <p className="whitespace-pre-line text-foreground/80">{config.texts.einleitung}</p>
            </section>
          )}

          {/* IST Analyse */}
          {config.blocks.ist_analyse && istDevices.length > 0 && (
            <section>
              <h2 className="text-lg font-heading font-bold text-primary border-b-2 border-secondary pb-1 mb-3">Ausgangssituation / IST-Analyse</h2>
              <p className="text-muted-foreground mb-3">
                Aktuell betreiben Sie <strong className="text-foreground">{istDevices.length} Geräte</strong> an{' '}
                <strong className="text-foreground">{sites.length} Standort{sites.length !== 1 ? 'en' : ''}</strong>.
              </p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Standort</th>
                    <th className="px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Hersteller</th>
                    <th className="px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Modell</th>
                    <th className="px-2 py-1.5 text-right font-heading text-[10px] uppercase tracking-wide">Anzahl</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(istGrouped).map(([key, items], i) => {
                    const first = items[0];
                    return (
                      <tr key={key} className={i % 2 === 1 ? 'bg-muted/30' : ''}>
                        <td className="border-b border-border px-2 py-1">{buildLocationStr(first) || '–'}</td>
                        <td className="border-b border-border px-2 py-1">{first.ist_manufacturer || '–'}</td>
                        <td className="border-b border-border px-2 py-1">{first.ist_model}</td>
                        <td className="border-b border-border px-2 py-1 text-right">{items.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {/* SOLL Konzept */}
          {config.blocks.soll_konzept && sollDevices.length > 0 && (
            <section>
              <h2 className="text-lg font-heading font-bold text-primary border-b-2 border-secondary pb-1 mb-3">SOLL-Konzept / Neue Geräteflotte</h2>
              <p className="text-muted-foreground mb-3">
                Das neue Konzept sieht <strong className="text-foreground">{sollDevices.length} Geräte</strong> vor
                {istDevices.length > 0 && (
                  <> – eine {sollDevices.length < istDevices.length ? 'Optimierung' : 'Anpassung'} um{' '}
                  <strong className="text-foreground">{Math.abs(istDevices.length - sollDevices.length)} Geräte</strong></>
                )}.
              </p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Standort</th>
                    <th className="px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Hersteller</th>
                    <th className="px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Modell</th>
                    <th className="px-2 py-1.5 text-right font-heading text-[10px] uppercase tracking-wide">Anzahl</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(sollGrouped).map(([key, items], i) => {
                    const first = items[0];
                    const loc = [first.soll_building, first.soll_floor, first.soll_room].filter(Boolean).join(', ');
                    return (
                      <tr key={key} className={i % 2 === 1 ? 'bg-muted/30' : ''}>
                        <td className="border-b border-border px-2 py-1">{loc || buildLocationStr(first) || '–'}</td>
                        <td className="border-b border-border px-2 py-1">{first.soll_manufacturer || '–'}</td>
                        <td className="border-b border-border px-2 py-1">{first.soll_model}</td>
                        <td className="border-b border-border px-2 py-1 text-right">{items.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {/* IST-SOLL Vergleich */}
          {config.blocks.ist_soll_vergleich && devices.some(d => d.ist_model && d.soll_model) && (
            <section>
              <h2 className="text-lg font-heading font-bold text-primary border-b-2 border-secondary pb-1 mb-3">IST-SOLL Vergleich</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Standort</th>
                    <th className="px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">IST Gerät</th>
                    <th className="px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">SOLL Gerät</th>
                    <th className="px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Optimierung</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.filter(d => d.ist_model || d.soll_model).map((d, i) => (
                    <tr key={d.id} className={i % 2 === 1 ? 'bg-muted/30' : ''}>
                      <td className="border-b border-border px-2 py-1">{buildLocationStr(d) || '–'}</td>
                      <td className="border-b border-border px-2 py-1">{d.ist_manufacturer} {d.ist_model || '–'}</td>
                      <td className="border-b border-border px-2 py-1">{d.soll_manufacturer} {d.soll_model || '–'}</td>
                      <td className="border-b border-border px-2 py-1">
                        {d.optimization_type && (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            d.optimization_type === 'OneToOne' ? 'bg-primary/10 text-primary' :
                            d.optimization_type === 'Keep' ? 'bg-muted text-muted-foreground' :
                            d.optimization_type === 'Abbau' ? 'bg-destructive/10 text-destructive' :
                            'bg-secondary/10 text-secondary'
                          }`}>
                            {d.optimization_type}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Standortübersicht */}
          {config.blocks.standortuebersicht && sites.length > 0 && (
            <section>
              <h2 className="text-lg font-heading font-bold text-primary border-b-2 border-secondary pb-1 mb-3">Standortübersicht</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Standort</th>
                    <th className="px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Adresse</th>
                    <th className="px-2 py-1.5 text-right font-heading text-[10px] uppercase tracking-wide">Geräte</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((loc, i) => {
                    const devCount = devices.filter(d => d.location_id === loc.id).length;
                    return (
                      <tr key={loc.id} className={i % 2 === 1 ? 'bg-muted/30' : ''}>
                        <td className="border-b border-border px-2 py-1 font-medium">{loc.name}</td>
                        <td className="border-b border-border px-2 py-1">
                          {[loc.address_street, loc.address_zip, loc.address_city].filter(Boolean).join(', ') || '–'}
                        </td>
                        <td className="border-b border-border px-2 py-1 text-right">{devCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {/* Finanzierung */}
          {config.blocks.finanzierung && calculation && (
            <section>
              <h2 className="text-lg font-heading font-bold text-primary border-b-2 border-secondary pb-1 mb-3">Finanzierung & Kosten</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground mb-1">Finanzierungsart</p>
                  <p className="font-medium">{calculation.finance_type === 'leasing' ? 'Leasing' : calculation.finance_type === 'miete' ? 'Miete' : calculation.finance_type || '–'}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground mb-1">Laufzeit</p>
                  <p className="font-medium">{calculation.term_months || 60} Monate</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 col-span-2">
                  <p className="text-[10px] font-heading uppercase tracking-wide text-primary mb-1">Monatliche Gesamtrate</p>
                  <p className="text-xl font-heading font-bold text-primary">{formatCurrency(calculation.total_monthly_rate)}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Inkl. Hardware, Service, Verbrauchsmaterial und Wartung. Alle Preise zzgl. MwSt.
              </p>
            </section>
          )}

          {/* Rollout Zeitplan */}
          {config.blocks.rollout_zeitplan && (project.rollout_start || project.rollout_end) && (
            <section>
              <h2 className="text-lg font-heading font-bold text-primary border-b-2 border-secondary pb-1 mb-3">Rollout-Zeitplan</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground mb-1">Start</p>
                  <p className="font-medium">{formatDate(project.rollout_start)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground mb-1">Ende</p>
                  <p className="font-medium">{formatDate(project.rollout_end)}</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                <p>Phasen: Vorbereitung → Auslieferung & Installation → Endkontrolle</p>
              </div>
            </section>
          )}

          {/* IT Konzept */}
          {config.blocks.it_konzept && itConfig && (
            <section>
              <h2 className="text-lg font-heading font-bold text-primary border-b-2 border-secondary pb-1 mb-3">IT-Konzept</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {itConfig.scan_methods && itConfig.scan_methods.length > 0 && (
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground mb-1">Scan-Methoden</p>
                    <p className="font-medium">{itConfig.scan_methods.join(', ')}</p>
                  </div>
                )}
                {itConfig.software_followme_system && (
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground mb-1">Follow-Me System</p>
                    <p className="font-medium">{itConfig.software_followme_system}</p>
                  </div>
                )}
                {itConfig.software_fleet_server && (
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground mb-1">Fleet Management</p>
                    <p className="font-medium">{itConfig.software_fleet_server}</p>
                  </div>
                )}
                {itConfig.training_type && itConfig.training_type.length > 0 && (
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground mb-1">Einweisung</p>
                    <p className="font-medium">{itConfig.training_type.join(', ')}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Abschluss */}
          {config.texts.abschluss && (
            <section>
              <h2 className="text-lg font-heading font-bold text-primary border-b-2 border-secondary pb-1 mb-3">Zusammenfassung</h2>
              <p className="whitespace-pre-line text-foreground/80">{config.texts.abschluss}</p>
            </section>
          )}

          {/* Ansprechpartner */}
          {config.blocks.ansprechpartner && (
            <section>
              <h2 className="text-lg font-heading font-bold text-primary border-b-2 border-secondary pb-1 mb-3">Ansprechpartner & Kontakt</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contactSirius && (
                  <div className="p-4 rounded-lg border border-border">
                    <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground mb-2">SIRIUS document solutions</p>
                    <p className="font-medium">{contactSirius}</p>
                  </div>
                )}
                {contactCustomer && (
                  <div className="p-4 rounded-lg border border-border">
                    <p className="text-[10px] font-heading uppercase tracking-wide text-muted-foreground mb-2">{customerName}</p>
                    <p className="font-medium">{contactCustomer}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Anmerkungen */}
          {config.texts.anmerkungen && (
            <section className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground italic whitespace-pre-line">{config.texts.anmerkungen}</p>
            </section>
          )}

          {/* Footer */}
          <div className="border-t border-border pt-3 text-center">
            <p className="text-[10px] text-muted-foreground">
              Vertraulich – erstellt am {formatDate(new Date().toISOString().slice(0, 10))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function groupBy<T>(arr: T[], fn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = fn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
