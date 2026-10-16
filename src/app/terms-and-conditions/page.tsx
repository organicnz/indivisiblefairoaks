import { DataPoint } from '@/components/ui/DataPoint';
import { getDataPoints } from '@/lib/queries/civic';

export default async function TermsPage() {
  const dataPoints = await getDataPoints('terms');

  return (
    <div className="bg-white min-h-screen pt-(--header-h) pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <DataPoint
          name="terms.hero.title"
          as="h1"
          initialData={dataPoints}
          className="text-4xl font-black text-secondary uppercase tracking-tight mb-8"
        >
          Terms and Conditions
        </DataPoint>
        <div className="h-1.5 w-24 bg-primary mb-12" />

        <div className="prose prose-slate max-w-none space-y-8 text-slate-600 font-medium leading-relaxed">
          <DataPoint
            name="terms.last_updated"
            as="p"
            initialData={dataPoints}
            className="text-xs font-black uppercase tracking-widest text-slate-400"
          >
            Last updated: October 2026
          </DataPoint>

          <DataPoint name="terms.intro" as="p" initialData={dataPoints}>
            These terms and conditions govern the relationship between you and Indivisible Fair
            Oaks-Carmichael. Including the use of this website, any contributions or interactions
            you make with us and our community programs. By accessing, browsing or using this site,
            you acknowledge and agree to these terms and conditions.
          </DataPoint>

          <section>
            <DataPoint
              name="terms.mission.title"
              as="h2"
              initialData={dataPoints}
              className="text-xl font-black text-secondary uppercase tracking-wider mb-4"
            >
              Grassroots Mission &amp; Non-Violence
            </DataPoint>
            <DataPoint name="terms.mission.body" as="p" initialData={dataPoints}>
              Indivisible Fair Oaks-Carmichael is a grassroots, non-partisan volunteer community
              organization. All participants and website visitors agree to uphold peaceful,
              disciplined nonviolent community norms.
            </DataPoint>
          </section>

          <section>
            <DataPoint
              name="terms.disclaimer.title"
              as="h2"
              initialData={dataPoints}
              className="text-xl font-black text-secondary uppercase tracking-wider mb-4"
            >
              Contribution &amp; Content Disclaimer
            </DataPoint>
            <DataPoint name="terms.disclaimer.body" as="p" initialData={dataPoints}>
              Contributions made to our chapter via ActBlue are non-tax-deductible gifts dedicated
              to local grassroots organizing, venue rentals, and civil advocacy. Content provided on
              this site is for educational and civic mobilization purposes.
            </DataPoint>
          </section>
        </div>
      </div>
    </div>
  );
}
