'use client';

import { Clock, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { SHIPPING_RATES } from '@/config/shipping';

export default function ShippingReturnsPage() {
  return (
    <div className="bg-white min-h-screen pt-(--header-h) pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-black text-secondary uppercase tracking-tight mb-4">
            Shipping & Returns
          </h1>
          <div className="h-2 w-24 bg-primary mx-auto" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
          <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
            <div className="bg-white w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <Truck className="text-primary-ink" size={28} />
            </div>
            <h2 className="text-xl font-black text-secondary uppercase mb-4">Shipping Policy</h2>
            <div className="space-y-4 text-slate-600 font-medium leading-relaxed">
              <p>
                We take every care in packing and dispatching your purchase. Title is retained by us
                until payment is received in full.
              </p>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm my-4 text-sm">
                <h3 className="font-black text-secondary uppercase tracking-wide mb-3">
                  Shipping Rates
                </h3>
                <ul className="space-y-3">
                  {SHIPPING_RATES.map((rate, i) => (
                    <li
                      key={rate.id}
                      className={`flex justify-between items-center ${i === SHIPPING_RATES.length - 1 ? 'pt-1' : 'border-b border-slate-50 pb-2'}`}
                    >
                      <span>{rate.name}</span>
                      <span
                        className={`font-black ${rate.amount === 0 ? 'text-primary-ink' : 'text-secondary'}`}
                      >
                        {rate.displayPrice}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <ul className="space-y-2 list-disc list-inside text-sm">
                <li>Direct community pickup & delivery for local actions</li>
                <li>Dispatched from Indivisible Fair Oaks Distribution Hub</li>
                <li>Indicative delivery times provided at order</li>
                <li>Civic materials packaged securely</li>
              </ul>
            </div>
          </div>

          <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
            <div className="bg-white w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <RotateCcw className="text-primary-ink" size={28} />
            </div>
            <h2 className="text-xl font-black text-secondary uppercase mb-4">
              Returns & Exchanges
            </h2>
            <div className="space-y-4 text-slate-600 font-medium leading-relaxed">
              <p>
                We comply with the Consumer Guarantees Act 1993 (CGA). Your satisfaction is our
                priority.
              </p>
              <ul className="space-y-2 list-disc list-inside text-sm">
                <li>Refund/Exchange requests within 5 days of receipt</li>
                <li>Original condition and packaging required</li>
                <li>Contact us before returning any items</li>
                <li>Full refund less shipping costs for change of mind</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="prose prose-slate max-w-none border-t border-slate-100 pt-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Clock className="text-slate-400" size={20} />
                <h3 className="text-lg font-black text-secondary uppercase m-0">Delivery Times</h3>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                Delivery times are indicative only. We will attempt to contact you by phone or email
                if any late deliveries are anticipated. We are not liable for failures to observe
                delivery times but work hard to ensure prompt arrival.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="text-slate-400" size={20} />
                <h3 className="text-lg font-black text-secondary uppercase m-0">Damaged Goods</h3>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                Indivisible Fair Oaks is dedicated to ensuring you receive all advocacy materials in
                good order. If you receive damaged items, please contact our volunteer logistics
                team immediately.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-20 text-center bg-secondary p-12 rounded-[3rem] text-white">
          <h3 className="text-2xl font-black uppercase mb-4">
            Need help with materials or an order?
          </h3>
          <p className="text-slate-300 mb-8 max-w-md mx-auto">
            Our volunteer organizing team is ready to assist with any questions regarding
            deliveries, rally materials, or community inquiries.
          </p>
          <a
            href="mailto:contact@indivisiblefairoaks.org"
            className="inline-block bg-primary hover:bg-white hover:text-secondary text-secondary font-black py-4 px-10 rounded-full transition-all uppercase tracking-widest text-sm"
          >
            Contact Organizing Team
          </a>
        </div>
      </div>
    </div>
  );
}
