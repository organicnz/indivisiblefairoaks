import { DollarSign, HeartHandshake, MapPin, UsersRound } from 'lucide-react';
import { DataPoint } from '@/components/ui/DataPoint';

type CRMMetricsProps = {
  dataPoints: Record<string, string>;
  totalContacts: number;
  activeVolunteers: number;
  localDistrict: number;
  totalDonors: number;
  totalDonationsCents: number;
};

export function CRMMetrics({
  dataPoints,
  totalContacts,
  activeVolunteers,
  localDistrict,
  totalDonors,
  totalDonationsCents,
}: CRMMetricsProps) {
  return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Constituents */}
        <div className="bg-surface-card p-5 rounded-2xl border border-border shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <UsersRound size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              <DataPoint as="span" name="admin.crm.kpi_contacts" initialData={dataPoints}>
                Total Constituents
              </DataPoint>
            </p>
            <p className="text-2xl font-black text-foreground mt-0.5">{totalContacts}</p>
          </div>
        </div>

        {/* Active Volunteers */}
        <div className="bg-surface-card p-5 rounded-2xl border border-border shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <HeartHandshake size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              <DataPoint as="span" name="admin.crm.kpi_volunteers" initialData={dataPoints}>
                Volunteers & Organizers
              </DataPoint>
            </p>
            <p className="text-2xl font-black text-foreground mt-0.5">{activeVolunteers}</p>
          </div>
        </div>

        {/* Local District */}
        <div className="bg-surface-card p-5 rounded-2xl border border-border shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <MapPin size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              <DataPoint as="span" name="admin.crm.kpi_district" initialData={dataPoints}>
                CA-06 / CA-03 Grassroots
              </DataPoint>
            </p>
            <p className="text-2xl font-black text-foreground mt-0.5">{localDistrict}</p>
          </div>
        </div>

        {/* Grassroots Donors */}
        <div className="bg-surface-card p-5 rounded-2xl border border-border shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <DollarSign size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              <DataPoint as="span" name="admin.crm.kpi_donors" initialData={dataPoints}>
                Grassroots Donors
              </DataPoint>
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className="text-2xl font-black text-foreground">{totalDonors}</p>
              <span className="text-xs font-bold text-amber-700">
                $
                {(totalDonationsCents / 100).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
  );
}
