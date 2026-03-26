import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import type { ConceptConfig } from '@/hooks/useConceptData';
import type { Tables } from '@/integrations/supabase/types';
import { formatDate, formatCurrency } from '@/lib/constants';

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

export default function KonzeptPreview({ config, project, devices, locations, calculation, itConfig }: Props) {
  const ref = useRef<HTMLDivElement>(null);

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
    const w = window.open('', '_blank');
    if (!w || !ref.current) return;
    w.document.write(`<!DOCTYPE html><html><head><title>MPS Konzept – ${customerName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Roboto:wght@300;400;500&display=swap');
        body{font-family:'Roboto',sans-serif;margin:0;padding:40px;color:#1a2744;font-size:13px;line-height:1.6}
        h1,h2,h3{font-family:'Montserrat',sans-serif;color:#003da5}
        h1{font-size:28px} h2{font-size:18px;border-bottom:2px solid #00a3e0;padding-bottom:4px;margin-top:32px}
        table{width:100%;border-collapse:collapse;margin:12px 0}
        th,td{border:1px solid #dde3ed;padding:6px 10px;text-align:left;font-size:12px}
        th{background:#f0f4fa;font-family:'Montserrat',sans-serif;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
        .cover{page-break-after:always;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:90vh;text-align:center}
        .cover h1{font-size:36px;margin-bottom:8px}
        .cover .subtitle{color:#00a3e0;font-size:14px;font-family:'Montserrat',sans-serif;font-weight:600;letter-spacing:2px;text-transform:uppercase}
        .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600}
        .badge-green{background:#dcfce7;color:#166534} .badge-blue{background:#dbeafe;color:#1e40af}
        .badge-amber{background:#fef3c7;color:#92400e} .badge-red{background:#fee2e2;color:#991b1b}
        .contact-box{border:1px solid #dde3ed;border-radius:8px;padding:16px;margin:8px 0}
        @media print{.no-print{display:none!important} .cover{min-height:95vh}}
      </style></head><body>`);
    w.document.write(ref.current.innerHTML);
    w.document.write('</body></html>');
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 no-print">
        <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
          <Printer className="h-4 w-4" /> Drucken / PDF
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
                  <tr className="bg-muted/50">
                    <th className="border border-border px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Standort</th>
                    <th className="border border-border px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Hersteller</th>
                    <th className="border border-border px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Modell</th>
                    <th className="border border-border px-2 py-1.5 text-right font-heading text-[10px] uppercase tracking-wide">Anzahl</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(istGrouped).map(([key, items]) => {
                    const first = items[0];
                    return (
                      <tr key={key} className="hover:bg-muted/30">
                        <td className="border border-border px-2 py-1">{buildLocationStr(first) || '–'}</td>
                        <td className="border border-border px-2 py-1">{first.ist_manufacturer || '–'}</td>
                        <td className="border border-border px-2 py-1">{first.ist_model}</td>
                        <td className="border border-border px-2 py-1 text-right">{items.length}</td>
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
                  <tr className="bg-muted/50">
                    <th className="border border-border px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Standort</th>
                    <th className="border border-border px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Hersteller</th>
                    <th className="border border-border px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Modell</th>
                    <th className="border border-border px-2 py-1.5 text-right font-heading text-[10px] uppercase tracking-wide">Anzahl</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(sollGrouped).map(([key, items]) => {
                    const first = items[0];
                    const loc = [first.soll_building, first.soll_floor, first.soll_room].filter(Boolean).join(', ');
                    return (
                      <tr key={key} className="hover:bg-muted/30">
                        <td className="border border-border px-2 py-1">{loc || buildLocationStr(first) || '–'}</td>
                        <td className="border border-border px-2 py-1">{first.soll_manufacturer || '–'}</td>
                        <td className="border border-border px-2 py-1">{first.soll_model}</td>
                        <td className="border border-border px-2 py-1 text-right">{items.length}</td>
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
                  <tr className="bg-muted/50">
                    <th className="border border-border px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Standort</th>
                    <th className="border border-border px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">IST Gerät</th>
                    <th className="border border-border px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">SOLL Gerät</th>
                    <th className="border border-border px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Optimierung</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.filter(d => d.ist_model || d.soll_model).map(d => (
                    <tr key={d.id} className="hover:bg-muted/30">
                      <td className="border border-border px-2 py-1">{buildLocationStr(d) || '–'}</td>
                      <td className="border border-border px-2 py-1">{d.ist_manufacturer} {d.ist_model || '–'}</td>
                      <td className="border border-border px-2 py-1">{d.soll_manufacturer} {d.soll_model || '–'}</td>
                      <td className="border border-border px-2 py-1">
                        {d.optimization_type && (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            d.optimization_type === 'upgrade' ? 'bg-primary/10 text-primary' :
                            d.optimization_type === 'downgrade' ? 'bg-amber-100 text-amber-800' :
                            d.optimization_type === 'remove' ? 'bg-destructive/10 text-destructive' :
                            'bg-muted text-muted-foreground'
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
                  <tr className="bg-muted/50">
                    <th className="border border-border px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Standort</th>
                    <th className="border border-border px-2 py-1.5 text-left font-heading text-[10px] uppercase tracking-wide">Adresse</th>
                    <th className="border border-border px-2 py-1.5 text-right font-heading text-[10px] uppercase tracking-wide">Geräte</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map(loc => {
                    const devCount = devices.filter(d => d.location_id === loc.id).length;
                    return (
                      <tr key={loc.id} className="hover:bg-muted/30">
                        <td className="border border-border px-2 py-1 font-medium">{loc.name}</td>
                        <td className="border border-border px-2 py-1">
                          {[loc.address_street, loc.address_zip, loc.address_city].filter(Boolean).join(', ') || '–'}
                        </td>
                        <td className="border border-border px-2 py-1 text-right">{devCount}</td>
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
