import { DataPoint } from '@/components/ui/DataPoint';
import { VgpuCivicConstellation } from '@/components/ui/VgpuCivicConstellation';
import { getDataPoints } from '@/lib/queries/civic';

export default async function PrivacyPage() {
  const dataPoints = await getDataPoints('privacy');

  return (
    <div className="relative overflow-hidden bg-background min-h-screen pt-(--header-h) pb-16 px-4 sm:px-6 lg:px-8 text-foreground transition-colors duration-300">
      <VgpuCivicConstellation className="pointer-events-none opacity-20" />
      <div className="relative z-10 max-w-3xl mx-auto">
        <DataPoint
          name="privacy.hero.title"
          as="h1"
          initialData={dataPoints}
          className="text-4xl font-black text-secondary dark:text-white uppercase tracking-tight mb-8"
        >
          Privacy Policy
        </DataPoint>
        <div className="h-1.5 w-24 bg-primary dark:bg-primary-bright mb-12" />

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-muted-foreground dark:text-ink-on-dark font-medium leading-relaxed">
          <DataPoint name="privacy.body.intro" as="p" initialData={dataPoints}>
            At Indivisible Fair Oaks-Carmichael, we recognise your right to confidentiality and are
            committed to protecting your privacy. Our website address is:
            https://indivisiblefairoaks.org.
          </DataPoint>

          <section>
            <DataPoint
              name="privacy.collect.title"
              as="h2"
              initialData={dataPoints}
              className="text-xl font-black text-secondary dark:text-white uppercase tracking-wider mb-4"
            >
              What data we collect
            </DataPoint>
            <DataPoint name="privacy.collect.body" as="p" initialData={dataPoints}>
              When visitors leave comments or place orders, we collect the data provided in the
              forms, and also the visitor&apos;s IP address and browser user agent string to help
              spam detection.
            </DataPoint>
          </section>

          <section>
            <DataPoint
              name="privacy.cookies.title"
              as="h2"
              initialData={dataPoints}
              className="text-xl font-black text-secondary dark:text-white uppercase tracking-wider mb-4"
            >
              Cookies
            </DataPoint>
            <DataPoint name="privacy.cookies.body1" as="p" initialData={dataPoints}>
              If you leave a comment on our site you may opt-in to saving your name, email address
              and website in cookies. These are for your convenience so that you do not have to fill
              in your details again.
            </DataPoint>
            <DataPoint name="privacy.cookies.body2" as="p" initialData={dataPoints}>
              When you log in, we will also set up several cookies to save your login information
              and your screen display choices. Login cookies last for two days, and screen options
              cookies last for a year.
            </DataPoint>
          </section>

          <section>
            <DataPoint
              name="privacy.embedded.title"
              as="h2"
              initialData={dataPoints}
              className="text-xl font-black text-secondary dark:text-white uppercase tracking-wider mb-4"
            >
              Embedded content
            </DataPoint>
            <DataPoint name="privacy.embedded.body" as="p" initialData={dataPoints}>
              Articles on this site may include embedded content (e.g. videos, images, articles,
              etc.). Embedded content from other websites behaves in the exact same way as if the
              visitor has visited the other website.
            </DataPoint>
          </section>

          <section>
            <DataPoint
              name="privacy.retain.title"
              as="h2"
              initialData={dataPoints}
              className="text-xl font-black text-secondary dark:text-white uppercase tracking-wider mb-4"
            >
              How long we retain your data
            </DataPoint>
            <DataPoint name="privacy.retain.body" as="p" initialData={dataPoints}>
              If you leave a comment, the comment and its metadata are retained indefinitely. For
              users that register on our website, we also store the personal information they
              provide in their user profile.
            </DataPoint>
          </section>

          <section>
            <DataPoint
              name="privacy.security.title"
              as="h2"
              initialData={dataPoints}
              className="text-xl font-black text-secondary dark:text-white uppercase tracking-wider mb-4"
            >
              Security
            </DataPoint>
            <DataPoint name="privacy.security.body" as="p" initialData={dataPoints}>
              We use a secure server for transactions to ensure absolute confidentiality. Under no
              circumstances is your information used for anything other than our grassroots
              organizing and communications.
            </DataPoint>
          </section>
        </div>
      </div>
    </div>
  );
}
