import { DataPoint } from '@/components/ui/DataPoint';

type AccountHeadingProps = {
  isAdmin: boolean;
  dataPoints: Record<string, string>;
};

export function AccountHeading({ isAdmin, dataPoints }: AccountHeadingProps) {
  return (
        <div className="flex flex-col mb-10">
          <p className="civic-kicker mb-4">
            {isAdmin ? 'Chapter operations' : 'Member account'}
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-foreground">
            <DataPoint
              name={isAdmin ? 'account.title.dashboard' : 'account.title.my_account'}
              initialData={dataPoints}
            >
              {isAdmin ? 'Dashboard' : 'My account'}
            </DataPoint>
          </h1>
          <div className="h-1.5 w-24 bg-primary dark:bg-primary-bright mt-3" />
        </div>
  );
}
