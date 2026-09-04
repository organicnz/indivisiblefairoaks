export default function PrivacyPage() {
  return (
    <div className="bg-white min-h-screen pt-(--header-h) pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-black text-secondary uppercase tracking-tight mb-8">
          Privacy Policy
        </h1>
        <div className="h-1.5 w-24 bg-primary mb-12" />

        <div className="prose prose-slate max-w-none space-y-8 text-slate-600 font-medium leading-relaxed">
          <p>
            At Indivisible Fair Oaks-Carmichael, we recognise your right to confidentiality and are
            committed to protecting your privacy. Our website address is:
            https://indivisiblefairoaks.org.
          </p>

          <section>
            <h2 className="text-xl font-black text-secondary uppercase tracking-wider mb-4">
              What data we collect
            </h2>
            <p>
              When visitors leave comments or place orders, we collect the data provided in the
              forms, and also the visitor&apos;s IP address and browser user agent string to help
              spam detection.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-secondary uppercase tracking-wider mb-4">
              Cookies
            </h2>
            <p>
              If you leave a comment on our site you may opt-in to saving your name, email address
              and website in cookies. These are for your convenience so that you do not have to fill
              in your details again.
            </p>
            <p>
              When you log in, we will also set up several cookies to save your login information
              and your screen display choices. Login cookies last for two days, and screen options
              cookies last for a year.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-secondary uppercase tracking-wider mb-4">
              Embedded content
            </h2>
            <p>
              Articles on this site may include embedded content (e.g. videos, images, articles,
              etc.). Embedded content from other websites behaves in the exact same way as if the
              visitor has visited the other website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-secondary uppercase tracking-wider mb-4">
              How long we retain your data
            </h2>
            <p>
              If you leave a comment, the comment and its metadata are retained indefinitely. For
              users that register on our website, we also store the personal information they
              provide in their user profile.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-secondary uppercase tracking-wider mb-4">
              Security
            </h2>
            <p>
              We use a secure server for credit card transactions to ensure absolute
              confidentiality. Under no circumstances is your credit card information used for
              anything other than orders.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
