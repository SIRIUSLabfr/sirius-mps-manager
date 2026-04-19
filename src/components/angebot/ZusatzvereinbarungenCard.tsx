import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, Plus, Trash2, Lock } from 'lucide-react';

export interface ZusatzItem {
  active: boolean;
  text: string;
  selectedOption?: string;
  customOptions?: { value: string; label: string; price?: string }[];
  /** If true, this is a user-added custom item that can be deleted */
  isCustom?: boolean;
}

export interface Zusatzvereinbarungen {
  mietfreie_startphase: string;
  berechnungsintervall: string;
  items: ZusatzItem[];
}

const DEFAULT_ITEMS: ZusatzItem[] = [
  { active: false, text: 'SIRIUS BestForAdminFleet ist im Lieferumfang enthalten. Dies bringt die Vorteile von automatischer Tonerlieferung und selbstständiger Zählerstandübermittlung mit sich.' },
  { active: false, text: 'Die neuen Geräte werden nach genauer Terminabsprache bereits im [MONAT] geliefert. Der ALL-IN-Vertrag beginnt zum [DATUM]. Dies entspricht einer mietfreien Startphase in Höhe von bis zu [X] Monaten. Die Kosten hierfür übernimmt die SIRIUS GmbH.' },
  { active: false, text: 'Die neuen Geräte werden nach genauer Terminabsprache mit Ihnen bereits im Februar/März geliefert. Die Aufstockung in den bestehenden ALL-IN-Vertrag # 041-XXXX beginnt zum 01.10.2023. Dies entspricht einer mietfreien Startphase in Höhe von bis zu 2,5 Monaten. Die Kosten hierfür übernimmt die SIRIUS GmbH.' },
  { active: false, text: 'Das Angebot gilt solange der Vorrat reicht.' },
  { active: false, text: 'Nach [X] Monaten hat der Kunde die Möglichkeit, das Gerät gegen eine neue, gleichwertige Maschine zu identischen Konditionen zu tauschen.' },
  { active: false, text: 'Innerhalb der folgenden 6 Monate wird das durchschnittliche monatliche Volumen ermittelt und zur Festlegung der Freiseiten und der Rate verwendet.' },
  { active: false, text: 'Die ersten 1.000 S/W-Seiten bis zum 31.3.2023 sind kostenfrei. Mehrseiten werden normal berechnet.' },
  { active: false, text: 'Für die offenen Raten Ihrer aktuellen Verträge erhalten Sie eine Gutschrift in Höhe von 100,00€. Dies entspricht 10 Restraten Ihres Altgeräts à mtl. 10,00€ (Leasingvertrag Kyocera FS2100dn).' },
  { active: false, text: 'Altgeräte werden auf Wunsch kostenfrei entsorgt.' },
  { active: false, text: 'Nach Abholung der Multifunktionsgeräte werden die Festplatten einer fachgemäßen, protokollierten Rücksetzung in den Werkszustand unterzogen oder entfernt und im Nachgang an Sie ausgehändigt bzw. zugeschickt.\nBitte wählen Sie eine Variante:', selectedOption: '' },
  { active: false, text: 'Gemäß Ihres Vertrages sind Sie verpflichtet, das Gerät auf Ihre Kosten durch hierfür geschultes, fachkundiges Personal zum Zentrallager Grenke Berlin zu transportieren. Gerne führen wir den Rücktransport inkl. transportfähig machen im Hause SIRIUS für Sie durch.', selectedOption: '' },
  { active: false, text: 'Bitte gewünschte Variante ankreuzen:', selectedOption: '', customOptions: [{ value: 'option1', label: 'Option 1' }, { value: 'option2', label: 'Option 2' }] },
];

/** Radio options only used in the PDF for the customer to check – NOT shown in app UI */
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
  /** Read-only values from active calculation (Single Source of Truth) */
  contractStart?: string | null;
  deliveryDate?: string | null;
}

const formatDateDe = (iso: string | null | undefined) => {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString('de-DE'); }
  catch { return iso; }
};

export default function ZusatzvereinbarungenCard({
  value,
  onChange,
  defaultOpen = false,
  contractStart,
  deliveryDate,
}: Props) {
  // Migration: ensure at least 12 base items
  const items: ZusatzItem[] = value.items && value.items.length >= 12
    ? value.items
    : DEFAULT_ITEMS;

  const updateItem = (idx: number, patch: Partial<ZusatzItem>) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    onChange({ ...value, items: newItems });
  };

  const isCustomOptionsItem = (idx: number) => idx === 11;

  const getCustomOptions = (item: ZusatzItem) => {
    return item.customOptions || [{ value: 'option1', label: 'Option 1' }, { value: 'option2', label: 'Option 2' }];
  };

  const updateCustomOptionLabel = (itemIdx: number, optIdx: number, label: string) => {
    const opts = [...getCustomOptions(items[itemIdx])];
    opts[optIdx] = { ...opts[optIdx], label };
    updateItem(itemIdx, { customOptions: opts });
  };

  const addCustomOption = (itemIdx: number) => {
    const opts = [...getCustomOptions(items[itemIdx])];
    const newVal = `option${Date.now()}`;
    opts.push({ value: newVal, label: `Option ${opts.length + 1}` });
    updateItem(itemIdx, { customOptions: opts });
  };

  const removeCustomOption = (itemIdx: number, optIdx: number) => {
    const opts = [...getCustomOptions(items[itemIdx])];
    if (opts.length <= 1) return;
    const removed = opts.splice(optIdx, 1);
    const patch: Partial<ZusatzItem> = { customOptions: opts };
    if (items[itemIdx].selectedOption === removed[0]?.value) {
      patch.selectedOption = '';
    }
    updateItem(itemIdx, patch);
  };

  const addNewItem = () => {
    const newItems = [...items, { active: true, text: '', isCustom: true }];
    onChange({ ...value, items: newItems });
  };

  const removeItem = (idx: number) => {
    const newItems = items.filter((_, i) => i !== idx);
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
            {/* Read-only values from Kalkulation (Single Source of Truth) */}
            {(contractStart || deliveryDate) && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
                  <Lock className="h-3 w-3" />
                  Aus Kalkulation übernommen (nicht editierbar)
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Lieferdatum</p>
                    <p className="font-medium">{formatDateDe(deliveryDate) || '–'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vertragsbeginn</p>
                    <p className="font-medium">{formatDateDe(contractStart) || '–'}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Änderungen erfolgen ausschließlich in der Kalkulation.
                </p>
              </div>
            )}

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

            {/* Configurable items */}
            {items.map((item, idx) => {
              const num = idx + 1;
              const hasCustomRadio = isCustomOptionsItem(idx);

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
                      placeholder={`Vereinbarung ${num}`}
                      value={item.text}
                      onChange={(e) => updateItem(idx, { text: e.target.value })}
                    />

                    {/* Custom editable radio options (item 12) */}
                    {hasCustomRadio && item.active && (
                      <div className="mt-2 space-y-2">
                        <RadioGroup
                          className="space-y-2"
                          value={item.selectedOption || ''}
                          onValueChange={(v) => updateItem(idx, { selectedOption: v })}
                        >
                          {getCustomOptions(item).map((opt, optIdx) => (
                            <div key={opt.value} className="flex items-center gap-2">
                              <RadioGroupItem value={opt.value} id={`z-${idx}-${opt.value}`} />
                              <Input
                                className="h-7 text-sm flex-1"
                                value={opt.label}
                                onChange={(e) => updateCustomOptionLabel(idx, optIdx, e.target.value)}
                                placeholder={`Option ${optIdx + 1}`}
                              />
                              {getCustomOptions(item).length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeCustomOption(idx, optIdx)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </RadioGroup>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => addCustomOption(idx)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Option hinzufügen
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Delete button for custom-added items */}
                  {item.isCustom && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive mt-0.5"
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}

            {/* Add new custom item */}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={addNewItem}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Weitere Vereinbarung hinzufügen
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
