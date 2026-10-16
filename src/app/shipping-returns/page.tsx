import { Clock, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import { DataPoint } from '@/components/ui/DataPoint';
import { SHIPPING_RATES } from '@/config/commerce';
import { pageMetadata } from '@/lib/metadata';
import { getDataPoints } from '@/lib/queries/civic';

export const metadata: Metadata = pageMetadata({
  title: 'Shipping & Returns',
  description:
    'Shipping policies, civic material delivery schedules, and return guidelines for Indivisible Fair Oaks-Carmichael.',
  path: '/shipping-returns',
});

export default async function ShippingReturnsPage() {
  const dataPoints = await getDataPoints('shipping');

  return (
    <div className="bg-background min-h-screen pt-(--header-h) pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <DataPoint
            name="shipping.hero.title"
            as="h1"
            initialData={dataPoints}
            className="text-4xl font-black text-foreground uppercase tracking-tight mb-4"
          >
            Shipping &amp; Returns
          </DataPoint>
          <div className="h-2 w-24 bg-primary mx-auto" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
          <div className="bg-surface-muted p-8 rounded-[2rem] border border-border">
            <div className="bg-surface-card w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <Truck className="text-primary-ink" size={28} />
            </div>
            <DataPoint
              name="shipping.policy.title"
              as="h2"
              initialData={dataPoints}
              className="text-xl font-black text-foreground uppercase mb-4"
            >
              Shipping &amp; Distribution
            </DataPoint>
            <div className="space-y-4 text-muted-foreground font-medium leading-relaxed">
              <DataPoint name="shipping.policy.body" as="p" initialData={dataPoints}>
                We take every care in packing and dispatching your grassroots materials and advocacy
                supplies. Advocacy items are dispatched from our local Indivisible Fair Oaks
                distribution hub.
              </DataPoint>

              <div className="bg-surface-card p-5 rounded-2xl border border-border shadow-sm my-4 text-sm">
                <DataPoint
                  name="shipping.rates.title"
                  as="h3"
                  initialData={dataPoints}
                  className="font-black text-foreground uppercase tracking-wide mb-3"
                >
                  Shipping &amp; Distribution Options
                </DataPoint>
                <ul className="space-y-3">
                  {SHIPPING_RATES.map((rate, i) => (
                    <li
                      key={rate.id}
                      className={`flex justify-between items-center ${i === SHIPPING_RATES.length - 1 ? 'pt-1' : 'border-b border-border pb-2'}`}
                    >
                      <span>{rate.name}</span>
                      <span
                        className={`font-black ${rate.amount === 0 ? 'text-primary-ink' : 'text-foreground'}`}
                      >
                        {rate.displayPrice}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <ul className="space-y-2 list-disc list-inside text-sm">
                <li>
                  <DataPoint name="shipping.bullet.pickup" as="span" initialData={dataPoints}>
                    Direct community pickup &amp; delivery for local actions
                  </DataPoint>
                </li>
                <li>
                  <DataPoint name="shipping.bullet.hub" as="span" initialData={dataPoints}>
                    Dispatched from Indivisible Fair Oaks Distribution Hub
                  </DataPoint>
                </li>
                <li>
                  <DataPoint
                    name="shipping.bullet.delivery_times"
                    as="span"
                    initialData={dataPoints}
                  >
                    Indicative delivery times provided at order
                  </DataPoint>
                </li>
                <li>
                  <DataPoint
                    name="shipping.bullet.secure_packaging"
                    as="span"
                    initialData={dataPoints}
                  >
                    Civic materials packaged securely
                  </DataPoint>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-surface-muted p-8 rounded-[2rem] border border-border">
            <div className="bg-surface-card w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <RotateCcw className="text-primary-ink" size={28} />
            </div>
            <DataPoint
              name="shipping.returns.title"
              as="h2"
              initialData={dataPoints}
              className="text-xl font-black text-foreground uppercase mb-4"
            >
              Returns &amp; Exchanges
            </DataPoint>
            <div className="space-y-4 text-muted-foreground font-medium leading-relaxed">
              <DataPoint name="shipping.returns.body" as="p" initialData={dataPoints}>
                Your satisfaction and grassroots participation are our highest priority. If an item
                arrives damaged or incomplete, contact our volunteer logistics team immediately.
              </DataPoint>
              <ul className="space-y-2 list-disc list-inside text-sm">
                <li>
                  <DataPoint
                    name="shipping.returns.bullet_30days"
                    as="span"
                    initialData={dataPoints}
                  >
                    Replacement requests within 30 days of receipt
                  </DataPoint>
                </li>
                <li>
                  <DataPoint
                    name="shipping.returns.bullet_posts"
                    as="span"
                    initialData={dataPoints}
                  >
                    Direct support for broken or damaged signposts
                  </DataPoint>
                </li>
                <li>
                  <DataPoint
                    name="shipping.returns.bullet_contact"
                    as="span"
                    initialData={dataPoints}
                  >
                    Contact us before returning any campaign items
                  </DataPoint>
                </li>
                <li>
                  <DataPoint
                    name="shipping.returns.bullet_support"
                    as="span"
                    initialData={dataPoints}
                  >
                    100% committed to community mobilization support
                  </DataPoint>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="prose prose-slate max-w-none border-t border-border pt-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Clock className="text-slate-400" size={20} />
                <DataPoint
                  name="shipping.delivery.title"
                  as="h3"
                  initialData={dataPoints}
                  className="text-lg font-black text-secondary uppercase m-0"
                >
                  Delivery Times
                </DataPoint>
              </div>
              <DataPoint
                name="shipping.delivery.body"
                as="p"
                initialData={dataPoints}
                className="text-muted-foreground text-sm leading-relaxed"
              >
                Delivery times are indicative. We work hard to ensure prompt arrival for upcoming
                rallies, canvassing events, and community actions.
              </DataPoint>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="text-muted-foreground" size={20} />
                <DataPoint
                  name="shipping.damaged.title"
                  as="h3"
                  initialData={dataPoints}
                  className="text-lg font-black text-foreground uppercase m-0"
                >
                  Damaged Goods
                </DataPoint>
              </div>
              <DataPoint
                name="shipping.damaged.body"
                as="p"
                initialData={dataPoints}
                className="text-muted-foreground text-sm leading-relaxed"
              >
                Indivisible Fair Oaks is dedicated to ensuring you receive all advocacy materials in
                good order. Please reach out to our volunteer logistics team if anything is damaged.
              </DataPoint>
            </div>
          </div>
        </div>

        <div className="mt-20 text-center bg-secondary p-12 rounded-[3rem] text-white">
          <DataPoint
            name="shipping.help.title"
            as="h3"
            initialData={dataPoints}
            className="text-2xl font-black uppercase mb-4"
          >
            Need help with materials or an order?
          </DataPoint>
          <DataPoint
            name="shipping.help.body"
            as="p"
            initialData={dataPoints}
            className="text-white/70 mb-8 max-w-md mx-auto"
          >
            Our volunteer organizing team is ready to assist with any questions regarding
            deliveries, rally materials, or community inquiries.
          </DataPoint>
          <a
            href="mailto:contact@indivisiblefairoaks.org"
            className="inline-block bg-primary hover:bg-primary-light text-white font-black py-4 px-10 rounded-full transition-all uppercase tracking-widest text-sm"
          >
            <DataPoint name="shipping.help.cta" as="span" initialData={dataPoints}>
              Contact Organizing Team
            </DataPoint>
          </a>
        </div>
      </div>
    </div>
  );
}
