import { DataPoint } from '@/components/ui/DataPoint';

type DonateDisclaimerProps = {
  dataPoints: Record<string, string>;
};

export function DonateDisclaimer({ dataPoints }: DonateDisclaimerProps) {
  return (
        <div className="space-y-2 border-y border-border py-6 text-xs text-muted-foreground">
          <DataPoint
            name="donate.disclaimer.title"
            as="p"
            initialData={dataPoints}
            className="font-bold text-muted-foreground dark:text-ink-on-dark"
          >
            Contribution Disclaimers:
          </DataPoint>
          <DataPoint name="donate.disclaimer.desc" as="p" initialData={dataPoints}>
            Contributions or gifts to Indivisible Fair Oaks-Carmichael via ActBlue are not
            tax-deductible as charitable contributions for federal income tax purposes. All funds
            are dedicated to grassroots organizing, rally equipment, voter turnout drives, and
            community meeting venue rentals.
          </DataPoint>
        </div>
  );
}
