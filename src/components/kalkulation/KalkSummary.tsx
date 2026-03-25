import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface KalkSummaryProps {
  financeType: string;
  termMonths: number;
  leasingFactor: number;
  hardwareEkTotal: number;
  marginTotal: number;
  abloeseTotal: number;
  serviceMonthly: number;
}

export default function KalkSummary({
  financeType,
  termMonths,
  leasingFactor,
  hardwareEkTotal,
  marginTotal,
  abloeseTotal,
  serviceMonthly,
}: KalkSummaryProps) {
  const totalInvestment = hardwareEkTotal + marginTotal;
  const investmentWithAbloese = totalInvestment + abloeseTotal;
  const hardwareRate =
    financeType === 'leasing'
      ? investmentWithAbloese * leasingFactor
      : investmentWithAbloese / termMonths;
  const totalMonthlyRate = hardwareRate + serviceMonthly;

  const fmt = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const Row = ({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) => (
    <div className={`flex justify-between items-center ${highlight ? 'bg-primary/5 rounded-lg p-3 -mx-1' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`font-heading ${bold ? 'font-extrabold text-primary' : 'font-bold'} ${highlight ? 'text-xl' : ''}`}>
        {value}
      </span>
    </div>
  );

  return (
    <Card className="border-primary/20 bg-primary/[0.02] sticky top-4">
      <CardHeader>
        <CardTitle className="font-heading text-base">Live-Zusammenfassung</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row label="Hardware EK" value={`${fmt(hardwareEkTotal)} €`} />
        <Row label="+ Marge" value={`${fmt(marginTotal)} €`} />
        <Separator />
        <Row label="Gesamtinvestition" value={`${fmt(totalInvestment)} €`} bold />
        {abloeseTotal > 0 && (
          <>
            <Row label="+ Ablöse Altvertrag" value={`${fmt(abloeseTotal)} €`} />
            <Separator />
            <Row label="Investition + Ablöse" value={`${fmt(investmentWithAbloese)} €`} bold />
          </>
        )}
        <Separator />
        <Row
          label={financeType === 'leasing' ? `× Leasingfaktor (${leasingFactor})` : `÷ ${termMonths} Monate`}
          value={`${fmt(hardwareRate)} € / Mon.`}
        />
        {serviceMonthly > 0 && <Row label="+ Service" value={`${fmt(serviceMonthly)} € / Mon.`} />}
        <Separator />
        <Row label="Monatliche Rate gesamt" value={`${fmt(totalMonthlyRate)} €`} bold highlight />

        <div className="text-xs text-muted-foreground pt-2 text-center">
          {financeType === 'leasing' ? 'Leasing (Bank)' : 'Miete (Eigen)'} · {termMonths} Monate
        </div>
      </CardContent>
    </Card>
  );
}
