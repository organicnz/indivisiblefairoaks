import { Calendar, FilePlus2, FileText, Users } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';

type KpiCardsProps = {
  dataPoints: Record<string, string>;
  published: number;
  drafts: number;
  eventCount: number;
  memberCount: number;
};

export function KpiCards({
  dataPoints,
  published,
  drafts,
  eventCount,
  memberCount,
}: KpiCardsProps) {
  return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            dpKey: 'admin.kpi.published',
            label: 'Published',
            value: published,
            icon: FileText,
          },
          {
            dpKey: 'admin.kpi.drafts',
            label: 'Drafts',
            value: drafts,
            icon: FilePlus2,
          },
          {
            dpKey: 'admin.kpi.events',
            label: 'Civic events',
            value: eventCount,
            icon: Calendar,
          },
          {
            dpKey: 'admin.kpi.members',
            label: 'Community members',
            value: memberCount,
            icon: Users,
          },
        ].map(({ dpKey, label, value, icon: Icon }) => (
          <div
            key={label}
            className="bg-secondary rounded-3xl p-6 border border-white/10 shadow-xs"
          >
            <Icon size={16} className="text-primary-on-dark mb-3" />
            <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-1">
              <DataPoint as="span" name={dpKey} initialData={dataPoints}>
                {label}
              </DataPoint>
            </p>
            <p className="text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>
  );
}
