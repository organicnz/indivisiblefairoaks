export default function TermsPage() {
  return (
    <div className="bg-white min-h-screen pt-(--header-h) pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-black text-secondary uppercase tracking-tight mb-8">
          Terms and Conditions
        </h1>
        <div className="h-1.5 w-24 bg-primary mb-12" />

        <div className="prose prose-slate max-w-none space-y-8 text-slate-600 font-medium leading-relaxed">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
            Last updated: 27 May 2021
          </p>

          <p>
            These terms and conditions govern the relationship between you and Indivisible Fair
            Oaks-Carmichael (Us). Including the use of this website, any contributions or orders you
            make from us and our community programs. By accessing, browsing or using this site, you
            acknowledge and agree to these terms and conditions.
          </p>

          <section>
            <h2 className="text-xl font-black text-secondary uppercase tracking-wider mb-4">
              Pricing Policy
            </h2>
            <p>
              All prices are shown in New Zealand dollars and are inclusive of GST. All prices are
              correct at time of publication, however we reserve the right to alter prices for any
              reason. If this should happen after you have ordered a product, we will contact you
              prior to processing your order.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-secondary uppercase tracking-wider mb-4">
              Product Availability
            </h2>
            <p>
              Products listed on our website are, to the best of our knowledge, available for
              purchase. If for any reason we are unable to supply a product for your order we will
              contact you to arrange a refund or alternative product if available.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-secondary uppercase tracking-wider mb-4">
              Refunds and Exchanges
            </h2>
            <p>
              We will comply with our obligations under the Consumer Guarantees Act 1993 (CGA). This
              includes your rights of exchange and refund as set out in the CGA.
            </p>
            <p>
              Except where required by the CGA, we will only offer a refund or exchange on goods
              sold if:
              <br />
              1. The refund or exchange is requested within 5 days of receipt; and
              <br />
              2. The product including any packaging is in such a condition that the product can be
              on sold for full price.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-secondary uppercase tracking-wider mb-4">
              Delivery
            </h2>
            <p>
              Title is retained by us in all products sold until payment is received in full.
              Subject to your rights under the CGA, liability for all items passes to the purchaser
              on dispatch.
            </p>
            <p>
              Delivery times given on this website are indicative only. Your order or materials will
              be dispatched from the Indivisible Fair Oaks distribution hub provided they have the
              items to fulfil your order in stock.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-secondary uppercase tracking-wider mb-4">
              Intellectual Property
            </h2>
            <p>
              We reserve all our rights to intellectual property in this website and the items we
              sell. This includes any trademarks, copyrights, designs, patents or any other
              intellectual property. You must not use any information in this website without our
              express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-black text-secondary uppercase tracking-wider mb-4">
              Governing Law
            </h2>
            <p>
              This agreement is governed by the laws of New Zealand and is subject to the exclusive
              jurisdiction of the New Zealand courts.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
