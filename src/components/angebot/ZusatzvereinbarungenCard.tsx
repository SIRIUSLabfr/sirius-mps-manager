import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

export interface ZusatzItem {
  active: boolean;
  text: string;
  /** For items 10-12: selected radio option */
  selectedOption?: string;
}

export interface Zusatzvereinbarungen {
  mietfreie_startphase: string;
  berechnungsintervall: string;
  items: ZusatzItem[];
}

const DEFAULT_ITEMS: ZusatzItem[] = [
  { active: false, text: 'SIRIUS BestForAdminFleet ist im Lieferumfang enthalten. Dies bringt die Vorteile von automatischer Tonerlieferung und selbstständiger Zählerstandübermittlung mit sich.' },
  { active: false, text: 'Die neuen Geräte werden nach genauer Terminabsprache bereits im [MONAT] geliefert. Der ALL-IN-Vertrag beginnt zum [DATUM]. Dies entspricht einer mietfreien Startphase in Höhe von bis zu [X] Monaten. Die Kosten hierfür übernimmt die SIRIUS GmbH.' },
  { active: false, text: '' },
  { active: false, text: 'Das Angebot gilt solange der Vorrat reicht.' },
  { active: false, text: 'Nach [X] Monaten hat der Kunde die Möglichkeit, das Gerät gegen eine neue, gleichwertige Maschine zu identischen Konditionen zu tauschen.' },
  { active: false, text: 'Innerhalb der folgenden 6 Monate wird das durchschnittliche monatliche Volumen ermittelt und zur Festlegung der Freiseiten und der Rate verwendet.' },
  { active: false, text: '' },
  { active: false, text: '' },
  { active: false, text: 'Altgeräte werden auf Wunsch kostenfrei entsorgt.' },
  { active: false, text: 'Festplatten-Behandlung nach Abholung:', selectedOption: '' },
  { active: false, text: 'Rücktransport Altgeräte:', selectedOption: '' },
  { active: false, text: 'Bitte gewünschte Variante ankreuzen:', selectedOption: '' },
];

export const RADIO_OPTIONS: Record<number, { value: string; label: string; price?: string }[]> = {
  9: [
    { value: 'ausbau', label: 'Festplattenausbau', price: '350,00 € je Gerät' },
    { value: 'loeschung', label: 'Protokollierte Löschung inkl. Zusendung des Protokolls', price: '150,00 € je Gerät' },
    { value: 'keine', label: 'Keine protokollierte Datenlöschung erwünscht' },
  ],
  10: [
    { value: 'versichert', label: 'Versicherter Rücktransport', price: '300,00 €' },
    { value: 'kunde', label: 'Transport durch den Kunden' },
  ],
  11: [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
  ],
};

export const defaultZusatzvereinbarungen: Zusatzvereinbarungen = {
  mietfreie_startphase: 'keine',
  berechnungsintervall: 'quartalsweise',
  items: DEFAULT_ITEMS,
};

interface Props {
  value: Zusatzvereinbarungen;
  onChange: (v: Zusatzvereinbarungen) => void;
  defaultOpen?: boolean;
}

export default function ZusatzvereinbarungenCard({ value, onChange, defaultOpen = false }: Props) {
  // Ensure items array has 12 entries (migration from old format)
  const items: ZusatzItem[] = value.items && value.items.length === 12
    ? value.items
    : DEFAULT_ITEMS;

  const updateItem = (idx: number, patch: Partial<ZusatzItem>) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onChange({ ...value, items: newItems });
  };

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
          <CardContent className="space-y-4">
            {/* Global settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b">
              <div>
                <Label>Mietfreie Startphase</Label>
                <Select value={value.mietfreie_startphase} onValueChange={(v) => onChange({ ...value, mietfreie_startphase: v })}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keine">Keine</SelectItem>
                    <SelectItem value="1_monat">1 Monat</SelectItem>
                    <SelectItem value="2_monate">2 Monate</SelectItem>
                    <SelectItem value="3_monate">3 Monate</SelectItem>
                    <SelectItem value="individuell">Individuell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Berechnungsintervall Zähler</Label>
                <Select value={value.berechnungsintervall} onValueChange={(v) => onChange({ ...value, berechnungsintervall: v })}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monatlich">Monatlich</SelectItem>
                    <SelectItem value="quartalsweise">Quartalsweise</SelectItem>
                    <SelectItem value="halbjaehrlich">Halbjährlich</SelectItem>
                    <SelectItem value="jaehrlich">Jährlich</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 12 configurable items */}
            {items.map((item, idx) => {
              const num = idx + 1;
              const hasRadio = RADIO_OPTIONS[idx] !== undefined;

              return (
                <div key={idx} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2 pt-0.5 shrink-0">
                    <span className="text-xs text-muted-foreground font-mono w-5">{num}.</span>
                    <Switch
                      checked={item.active}
                      onCheckedChange={(c) => updateItem(idx, { active: c })}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Textarea
                      className="text-sm min-h-[36px] resize-y"
                      rows={item.text.length > 80 ? 3 : 1}
                      placeholder={`Vereinbarung ${num} (Freitext)`}
                      value={item.text}
                      onChange={(e) => updateItem(idx, { text: e.target.value })}
                    />
                    {hasRadio && item.active && (
                      <RadioGroup
                        className="mt-2 space-y-1"
                        value={item.selectedOption || ''}
                        onValueChange={(v) => updateItem(idx, { selectedOption: v })}
                      >
                        {RADIO_OPTIONS[idx].map((opt) => (
                          <div key={opt.value} className="flex items-center gap-2">
                            <RadioGroupItem value={opt.value} id={`z-${idx}-${opt.value}`} />
                            <Label htmlFor={`z-${idx}-${opt.value}`} className="text-sm font-normal cursor-pointer">
                              {opt.label}{opt.price ? ` (${opt.price})` : ''}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
