import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Zusatzvereinbarungen {
  lieferpauschale_active: boolean;
  lieferpauschale_betrag: number;
  basiseinweisung_active: boolean;
  basiseinweisung_text: string;
  it_installation_active: boolean;
  it_installation_text: string;
  abholung_altgeraete_active: boolean;
  abholung_altgeraete_type: 'kostenlos' | 'pauschale';
  abholung_altgeraete_betrag: number;
  mietfreie_startphase: string;
  erhoehbar_active: boolean;
  erhoehbar_prozent: number;
  berechnungsintervall: string;
  sonderkuendigungsrecht_active: boolean;
  sonderkuendigungsrecht_text: string;
  weitere_vereinbarung: string;
}

export const defaultZusatzvereinbarungen: Zusatzvereinbarungen = {
  lieferpauschale_active: false,
  lieferpauschale_betrag: 0,
  basiseinweisung_active: false,
  basiseinweisung_text: 'Grundeinweisung in die Bedienung der Geräte',
  it_installation_active: false,
  it_installation_text: 'Netzwerkintegration und Treiberinstallation',
  abholung_altgeraete_active: false,
  abholung_altgeraete_type: 'kostenlos',
  abholung_altgeraete_betrag: 0,
  mietfreie_startphase: 'keine',
  erhoehbar_active: false,
  erhoehbar_prozent: 3,
  berechnungsintervall: 'quartalsweise',
  sonderkuendigungsrecht_active: false,
  sonderkuendigungsrecht_text: '',
  weitere_vereinbarung: '',
};

interface Props {
  value: Zusatzvereinbarungen;
  onChange: (v: Zusatzvereinbarungen) => void;
  defaultOpen?: boolean;
}

export default function ZusatzvereinbarungenCard({ value, onChange, defaultOpen = false }: Props) {
  const update = (patch: Partial<Zusatzvereinbarungen>) => onChange({ ...value, ...patch });

  const content = (
    <div className="space-y-4">
      {/* Lieferpauschale */}
      <div className="flex items-center gap-3">
        <Checkbox checked={value.lieferpauschale_active} onCheckedChange={(c) => update({ lieferpauschale_active: !!c })} />
        <Label className="flex-1">Lieferpauschale</Label>
        {value.lieferpauschale_active && (
          <div className="flex items-center gap-1">
            <Input type="number" className="w-24 h-8 text-sm" value={value.lieferpauschale_betrag || ''} onChange={(e) => update({ lieferpauschale_betrag: parseFloat(e.target.value) || 0 })} />
            <span className="text-sm text-muted-foreground">€</span>
          </div>
        )}
      </div>

      {/* Basiseinweisung */}
      <div className="flex items-start gap-3">
        <Checkbox checked={value.basiseinweisung_active} onCheckedChange={(c) => update({ basiseinweisung_active: !!c })} className="mt-1" />
        <div className="flex-1">
          <Label>Basiseinweisung</Label>
          {value.basiseinweisung_active && (
            <Input className="mt-1 h-8 text-sm" value={value.basiseinweisung_text} onChange={(e) => update({ basiseinweisung_text: e.target.value })} />
          )}
        </div>
      </div>

      {/* IT-Installation */}
      <div className="flex items-start gap-3">
        <Checkbox checked={value.it_installation_active} onCheckedChange={(c) => update({ it_installation_active: !!c })} className="mt-1" />
        <div className="flex-1">
          <Label>IT-Installation</Label>
          {value.it_installation_active && (
            <Input className="mt-1 h-8 text-sm" value={value.it_installation_text} onChange={(e) => update({ it_installation_text: e.target.value })} />
          )}
        </div>
      </div>

      {/* Abholung Altgeräte */}
      <div className="flex items-start gap-3">
        <Checkbox checked={value.abholung_altgeraete_active} onCheckedChange={(c) => update({ abholung_altgeraete_active: !!c })} className="mt-1" />
        <div className="flex-1">
          <Label>Abholung Altgeräte</Label>
          {value.abholung_altgeraete_active && (
            <div className="flex items-center gap-2 mt-1">
              <Select value={value.abholung_altgeraete_type} onValueChange={(v) => update({ abholung_altgeraete_type: v as any })}>
                <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kostenlos">Kostenlos</SelectItem>
                  <SelectItem value="pauschale">Pauschale</SelectItem>
                </SelectContent>
              </Select>
              {value.abholung_altgeraete_type === 'pauschale' && (
                <div className="flex items-center gap-1">
                  <Input type="number" className="w-24 h-8 text-sm" value={value.abholung_altgeraete_betrag || ''} onChange={(e) => update({ abholung_altgeraete_betrag: parseFloat(e.target.value) || 0 })} />
                  <span className="text-sm text-muted-foreground">€</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mietfreie Startphase */}
      <div>
        <Label>Mietfreie Startphase</Label>
        <Select value={value.mietfreie_startphase} onValueChange={(v) => update({ mietfreie_startphase: v })}>
          <SelectTrigger className="mt-1 h-8 text-sm w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="keine">Keine</SelectItem>
            <SelectItem value="1_monat">1 Monat</SelectItem>
            <SelectItem value="2_monate">2 Monate</SelectItem>
            <SelectItem value="3_monate">3 Monate</SelectItem>
            <SelectItem value="individuell">Individuell</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Erhöhbar */}
      <div className="flex items-center gap-3">
        <Checkbox checked={value.erhoehbar_active} onCheckedChange={(c) => update({ erhoehbar_active: !!c })} />
        <Label>Erhöhbar</Label>
        {value.erhoehbar_active && (
          <div className="flex items-center gap-1">
            <Input type="number" className="w-20 h-8 text-sm" value={value.erhoehbar_prozent || ''} onChange={(e) => update({ erhoehbar_prozent: parseFloat(e.target.value) || 0 })} />
            <span className="text-sm text-muted-foreground">% p.a.</span>
          </div>
        )}
      </div>

      {/* Berechnungsintervall */}
      <div>
        <Label>Berechnungsintervall Zähler</Label>
        <Select value={value.berechnungsintervall} onValueChange={(v) => update({ berechnungsintervall: v })}>
          <SelectTrigger className="mt-1 h-8 text-sm w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="monatlich">Monatlich</SelectItem>
            <SelectItem value="quartalsweise">Quartalsweise</SelectItem>
            <SelectItem value="halbjaehrlich">Halbjährlich</SelectItem>
            <SelectItem value="jaehrlich">Jährlich</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sonderkündigungsrecht */}
      <div className="flex items-start gap-3">
        <Checkbox checked={value.sonderkuendigungsrecht_active} onCheckedChange={(c) => update({ sonderkuendigungsrecht_active: !!c })} className="mt-1" />
        <div className="flex-1">
          <Label>Sonderkündigungsrecht</Label>
          {value.sonderkuendigungsrecht_active && (
            <Input className="mt-1 h-8 text-sm" placeholder="z.B. nach 36 Monaten zum Quartalsende" value={value.sonderkuendigungsrecht_text} onChange={(e) => update({ sonderkuendigungsrecht_text: e.target.value })} />
          )}
        </div>
      </div>

      {/* Weitere Vereinbarung */}
      <div>
        <Label>Weitere Vereinbarung (Freitext)</Label>
        <Textarea className="mt-1 text-sm" rows={3} placeholder="Zusätzliche Klauseln oder Vereinbarungen..." value={value.weitere_vereinbarung} onChange={(e) => update({ weitere_vereinbarung: e.target.value })} />
      </div>
    </div>
  );

  return (
    <Card>
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="flex items-center justify-between text-base">
              <span>📋 Zusatzvereinbarungen</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>{content}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
