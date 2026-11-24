export function PrivacyPolicyContent() {
  return (
    <>
      <p>
        Indivisible Fair Oaks-Carmichael is a volunteer-run chapter in Sacramento County,
        California. This policy covers this website and the chapter forms connected to it. It does
        not cover third-party sites we link to.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Contact messages:</strong> the name, email address, and message you submit through
          our contact form, plus the optional preference to receive chapter email.
        </li>
        <li>
          <strong>ICE incident reports:</strong> the city, state, rough time, category, and
          text-only observation you submit through the private report form. The form does not ask
          for your name or contact details, but it is not technically anonymous: hosting, security,
          and abuse-prevention systems may process limited technical data such as an IP-derived
          rate-limit key.
        </li>
        <li>
          <strong>Account information:</strong> if you create an account, we store your email
          address and authentication data through our hosted authentication provider.
        </li>
        <li>
          <strong>Basic usage data:</strong> privacy-conscious analytics may record page views,
          approximate region, device type, and referral source. We use this to understand which
          pages are useful; we do not use it to identify individual visitors.
        </li>
        <li>
          <strong>Display preferences:</strong> your theme choice and similar interface settings may
          be stored in your browser.
        </li>
      </ul>

      <h2>Why we collect it</h2>
      <p>
        We use contact information to reply to you, coordinate volunteering, send requested chapter
        updates, and maintain the security of the site. We do not sell your personal information,
        and we do not share it with candidates or campaigns for their own fundraising.
      </p>

      <h2>ICE incident reports</h2>
      <p>
        The private ICE report form is text-only. It does not accept attachments, photos, or video.
        Raw reports are stored privately, are available only to authorized chapter moderators
        through the admin system, and are retained for up to 30 days. A raw report is never
        published.
      </p>
      <p>
        A unique, low-risk report may automatically publish only a generated city-level summary.
        That summary contains the city, state, category, rough observation time, a generic
        unverified description, and an approximate city-center map point. Reports that closely match
        an existing report in the same city, state, and category within two hours are combined into
        one public entry with a corroboration count. Reports with safety flags or no verified city
        are held for manual review, where a first reviewer may prepare a sanitized draft and a
        second, different reviewer must approve it. Raw report text is never published. Public
        entries expire after seven days.
      </p>
      <p>
        Do not use this form to send anyone&apos;s personal information or to report an emergency.
        It cannot dispatch help. Reports may be rejected, and submitting one does not create a
        guaranteed response or a legal record. We may disclose report data if required by law or to
        address an immediate safety risk.
      </p>

      <h2>Public web-source reports</h2>
      <p>
        The chapter may crawl an approved public source page or feed and republish its readable
        source text with the original URL, source label, publication time, and retrieval time. The
        crawler stores the fetched readable text and page metadata privately for audit, and does not
        bypass logins or robots.txt. An AI filtering step may remove navigation menus, consent copy,
        footers, and feedback prompts; it does not rewrite the report&apos;s substantive wording.
        Only sources added by an authorized admin with a republishing-rights confirmation are
        eligible. These reports are not independently verified by the chapter, and the source&apos;s
        own terms and privacy policy apply to the original page.
      </p>
      <p>
        If you believe a public source report should be removed or corrected, email{' '}
        <a href="mailto:contact@indivisiblefairoaks.org">contact@indivisiblefairoaks.org</a> with
        the source URL and the specific concern. We will review the source and, where appropriate,
        remove the republished entry.
      </p>

      <h2>Service providers</h2>
      <p>
        The site runs on Vercel, stores data with Supabase, and may use privacy-conscious analytics
        and error monitoring. These providers process data on the chapter&apos;s behalf so the site
        can function. Embedded YouTube videos are loaded only when you choose to play them, and
        YouTube&apos;s own privacy policy applies once you do.
      </p>

      <h2>Cookies and browser storage</h2>
      <p>
        We use cookies or local browser storage for sign-in sessions, security, display preferences,
        and analytics identifiers. We do not use advertising cookies. You can clear browser storage
        at any time; some signed-in features will then require you to sign in again.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Contact messages are kept while the chapter needs them to respond and maintain its
        organizing records. Account data is kept until you ask us to delete the account or the
        chapter no longer needs it. Analytics data is retained according to the provider&apos;s
        configured retention period.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask to see, correct, or delete personal information we hold about you, and you can
        unsubscribe from chapter email using the link in any message. Email{' '}
        <a href="mailto:contact@indivisiblefairoaks.org">contact@indivisiblefairoaks.org</a> and a
        volunteer will follow up.
      </p>
      <p>
        Vercel Analytics and Speed Insights send aggregate page-view and performance data. Our Do
        Not Track / Global Privacy Control handling applies only to PostHog: when either signal is
        set, PostHog is not initialized. We do not record session replays.
      </p>

      <h2>Security and changes</h2>
      <p>
        We use reputable hosting and authentication providers, but no website can promise perfect
        security. If this policy changes materially, we will update the date at the top of this page
        and describe the change here.
      </p>
    </>
  );
}
