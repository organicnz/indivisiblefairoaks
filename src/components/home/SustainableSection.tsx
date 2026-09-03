import Image from 'next/image';
import Link from 'next/link';

export function SustainableSection() {
  return (
    <section className="bg-slate-50 py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          <div className="lg:w-1/2 order-1 lg:order-1">
            <div className="relative aspect-square w-full max-w-[500px] mx-auto rounded-[3rem] overflow-hidden shadow-2xl border border-slate-200 group mb-8 lg:mb-0">
              <Image
                src="/sustainable-bumper.png"
                alt="Catch-22 Sustainable Fishing Bumper Sticker"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent pointer-events-none" />
            </div>
          </div>

          <div className="lg:w-1/2 order-2 lg:order-2">
            <span className="text-primary-ink font-black uppercase tracking-[0.4em] text-[10px] mb-6 block">
              Our Commitment
            </span>
            <h2 className="text-5xl md:text-7xl font-black text-secondary uppercase tracking-tighter leading-[0.9] mb-10">
              Be Proud To Be A <br /> <span className="text-slate-500">Sustainable</span> <br />{' '}
              Fisherman
            </h2>
            <p className="text-slate-500 text-xl font-medium leading-relaxed mb-12">
              At Catch-22, we believe in protecting the waters that sustain us. 2.5% of all our
              profits are donated directly to the NZ Sea Cleaners Charitable Trust, ensuring our
              oceans remain pristine for the next generation of anglers.
            </p>

            <div className="flex flex-col sm:flex-row gap-6">
              <Link
                href="/products/catch-22-bumper-sticker"
                className="inline-block bg-secondary text-white font-black py-6 px-10 rounded-2xl transition-all uppercase tracking-[0.2em] text-xs hover:bg-primary hover:text-secondary text-center"
              >
                Get Your Sticker Today
              </Link>
              <Link
                href="/about-us"
                className="inline-block bg-transparent border border-slate-200 text-secondary font-black py-6 px-10 rounded-2xl transition-all uppercase tracking-[0.2em] text-xs hover:border-primary text-center"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
