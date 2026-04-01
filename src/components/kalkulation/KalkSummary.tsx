import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';

interface MischklickData {
  totalSwCost: number;
  totalSwVolume: number;
  mischklickSw: number;
  totalColorCost: number;
  totalColorVolume: number;
  mischklickColor: number;
  totalServiceRate: number;
}

interface KalkSummaryProps {
  financeType: string;
  termMonths: number;
  leasingFactor: number;
  hardwareEkTotal: number;
  marginTotal: number;
  abloeseTotal: number;
  hwMonthly: number;
  totalRate: number;
  mischklick: MischklickData;
  folgeseitenpreisSw: number;
  folgeseitenpreisFarbe: number;
  onFolgeseitenpreisChange: (field: 'sw' | 'farbe', value: number) => void;
}

const fmt = (v: number) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmt4 = (v: number) =>
  v.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export default function KalkSummary({
  financeType,
  termMonths,
  hardwareEkTotal,
  marginTotal,
  abloeseTotal,
  hwMonthly,
  totalRate,
  mischklick,
}: KalkSummaryProps) {
  const investTotal = hardwareEkTotal + marginTotal + abloeseTotal;

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
      <span className={`font-heading ${bold ? 'font-extrabold' : 'font-medium'} text-sm`}>
        {value}
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Big hero card */}
      <Card className="border-0 shadow-lg" style={{ backgroundColor: '#001A5C' }}>
        <CardContent className="py-6 text-center space-y-1">
          <p className="text-xs font-heading uppercase tracking-widest text-white/70">
            Monatliche All-In-Rate
          </p>
          <p className="text-3xl font-heading font-extrabold" style={{ color: '#00A3E0' }}>
            {fmt(totalRate)} €
          </p>
          <p className="text-[10px] text-white/50">
            {financeType === 'leasing' ? 'Leasing (Bank)' : financeType === 'eigenmiete' ? 'Eigenmiete (SIRIUS)' : financeType === 'kauf_wv' ? 'Kauf + WV' : financeType === 'all_in' ? 'All-In-Vertrag' : 'Miete (Eigen)'} · {termMonths} Monate
          </p>
        </CardContent>
      </Card>

      {/* Volume & Mischklick box */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <p className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">
            Volumen & Mischklick
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-muted/40 rounded-md">
              <p className="text-lg font-heading font-bold">
                {mischklick.totalSwVolume.toLocaleString('de-DE')}
              </p>
              <p className="text-[10px] text-muted-foreground">Gesamtvolumen S/W</p>
            </div>
            <div className="text-center p-2 bg-muted/40 rounded-md">
              <p className="text-lg font-heading font-bold">
                {mischklick.totalColorVolume.toLocaleString('de-DE')}
              </p>
              <p className="text-[10px] text-muted-foreground">Gesamtvolumen Farbe</p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 rounded-md" style={{ backgroundColor: 'hsl(196 100% 44% / 0.08)' }}>
              <p className="text-lg font-heading font-bold" style={{ color: '#00A3E0' }}>
                {mischklick.totalSwVolume > 0 ? `${fmt4(mischklick.mischklickSw)} €` : '–'}
              </p>
              <p className="text-[10px] text-muted-foreground">Mischklick S/W</p>
            </div>
            <div className="text-center p-2 rounded-md" style={{ backgroundColor: 'hsl(196 100% 44% / 0.08)' }}>
              <p className="text-lg font-heading font-bold" style={{ color: '#00A3E0' }}>
                {mischklick.totalColorVolume > 0 ? `${fmt4(mischklick.mischklickColor)} €` : '–'}
              </p>
              <p className="text-[10px] text-muted-foreground">Mischklick Farbe</p>
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
            label={financeType === 'leasing' || financeType === 'all_in' ? 'Hardware Rate (Leasing)' : financeType === 'kauf_wv' ? 'Hardware Kaufpreis' : 'Hardware Rate (Miete)'}
            value={financeType === 'kauf_wv' ? `${fmt(investTotal)} €` : `${fmt(hwMonthly)} € / Mon.`}
          />
          <Row label="Service Rate (alle Klicks)" value={`${fmt(mischklick.totalServiceRate)} € / Mon.`} />
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
