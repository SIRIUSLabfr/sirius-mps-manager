import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface KalkSummaryProps {
  financeType: string;
  termMonths: number;
  leasingFactor: number;
  hardwareEkTotal: number;
  marginTotal: number;
  abloeseTotal: number;
  serviceMonthly: number;
  volumeBw: number;
  volumeColor: number;
  followBw: number;
  followColor: number;
  onFollowBwChange: (v: number) => void;
  onFollowColorChange: (v: number) => void;
}

const fmt = (v: number) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function KalkSummary({
  financeType,
  termMonths,
  leasingFactor,
  hardwareEkTotal,
  marginTotal,
  abloeseTotal,
  serviceMonthly,
  volumeBw,
  volumeColor,
  followBw,
  followColor,
  onFollowBwChange,
  onFollowColorChange,
}: KalkSummaryProps) {
  const investTotal = hardwareEkTotal + marginTotal + abloeseTotal;
  const hwMonthly =
    financeType === 'leasing'
      ? investTotal * leasingFactor
      : investTotal / termMonths;
  const totalRate = hwMonthly + serviceMonthly;

  const Row = ({
    label,
    value,
    bold,
    sub,
  }: {
    label: string;
    value: string;
    bold?: boolean;
    sub?: boolean;
  }) => (
    <div className={`flex justify-between items-center ${sub ? 'pl-4' : ''}`}>
      <span
        className={`text-sm ${bold ? 'font-semibold text-foreground' : 'text-muted-foreground'} ${sub ? 'text-xs' : ''}`}
      >
        {label}
      </span>
      <span
        className={`font-heading ${bold ? 'font-extrabold' : 'font-medium'} text-sm`}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="space-y-4 sticky top-4">
      {/* Big hero card */}
      <Card className="bg-primary text-primary-foreground border-0 shadow-lg">
        <CardContent className="py-6 text-center space-y-1">
          <p className="text-xs font-heading uppercase tracking-widest opacity-80">
            Monatliche All-In-Rate
          </p>
          <p className="text-3xl font-heading font-extrabold text-secondary">
            {fmt(totalRate)} €
          </p>
          <p className="text-[10px] opacity-60">
            {financeType === 'leasing' ? 'Leasing (Bank)' : 'Miete (Eigen)'} · {termMonths} Monate
          </p>
        </CardContent>
      </Card>

      {/* Volume box */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <p className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">
            Volumen
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-muted/40 rounded-md">
              <p className="text-lg font-heading font-bold">{volumeBw.toLocaleString('de-DE')}</p>
              <p className="text-[10px] text-muted-foreground">Gesamt S/W</p>
            </div>
            <div className="text-center p-2 bg-muted/40 rounded-md">
              <p className="text-lg font-heading font-bold">{volumeColor.toLocaleString('de-DE')}</p>
              <p className="text-[10px] text-muted-foreground">Gesamt Farbe</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px]">Folgeseite S/W €</Label>
              <Input
                type="number"
                step="0.0001"
                value={followBw || ''}
                onChange={(e) => onFollowBwChange(parseFloat(e.target.value) || 0)}
                className="h-8 text-xs"
                placeholder="0.0000"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Folgeseite Farbe €</Label>
              <Input
                type="number"
                step="0.0001"
                value={followColor || ''}
                onChange={(e) => onFollowColorChange(parseFloat(e.target.value) || 0)}
                className="h-8 text-xs"
                placeholder="0.0000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail table */}
      <Card>
        <CardContent className="py-4 space-y-2">
          <p className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">
            Aufschlüsselung
          </p>
          <Row
            label={financeType === 'leasing' ? 'Hardware Rate (Leasing)' : 'Hardware Rate (Miete)'}
            value={`${fmt(hwMonthly)} € / Mon.`}
          />
          <Row label="Service Rate (Klicks)" value={`${fmt(serviceMonthly)} € / Mon.`} />
          <Separator />
          <Row label="Gesamtinvestition" value={`${fmt(investTotal)} €`} bold />
          <Row label="Davon Hardware EK" value={`${fmt(hardwareEkTotal)} €`} sub />
          <Row label="Davon Marge" value={`${fmt(marginTotal)} €`} sub />
          {abloeseTotal > 0 && (
            <Row label="Davon Ablöse" value={`${fmt(abloeseTotal)} €`} sub />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
