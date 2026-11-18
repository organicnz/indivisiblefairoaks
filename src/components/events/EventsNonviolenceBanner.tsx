import { AlertCircle } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';

type EventsNonviolenceBannerProps = {
  dataPoints: Record<string, string>;
};

export function EventsNonviolenceBanner({ dataPoints }: EventsNonviolenceBannerProps) {
  return (
    <div className="flex items-start gap-4 border-y border-border bg-surface-card p-6">
          <AlertCircle className="text-accent dark:text-accent-gold shrink-0 mt-1" size={24} />
          <div className="text-xs sm:text-sm text-muted-foreground dark:text-ink-on-dark leading-relaxed">
            <DataPoint
              initialData={dataPoints}
              as="strong"
              name="events.nonviolence.title"
              className="text-foreground dark:text-white block mb-1"
            >
              Our Nonviolent Commitment:
            </DataPoint>
            <DataPoint initialData={dataPoints} as="span" name="events.nonviolence.desc">
              All Indivisible Fair Oaks-Carmichael events are strictly nonviolent. We expect all
              attendees to act lawfully and de-escalate any potential confrontation with
              counter-protesters. No weapons are permitted at any event.
            </DataPoint>
          </div>
        </div>
  );
}
