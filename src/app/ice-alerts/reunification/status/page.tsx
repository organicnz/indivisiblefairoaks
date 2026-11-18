import type { Metadata } from 'next';
import { ReunificationStatusDetails } from '@/components/ice-alerts/reunification-status/ReunificationStatusDetails';
import { StatusMessage } from '@/components/ice-alerts/reunification-status/StatusMessage';
import { env } from '@/lib/env';
import {
  findReunificationStatus,
  getReunificationStore,
  isReunificationUuid,
} from '@/lib/ice-reunification';
import { pageMetadata } from '@/lib/metadata';

export const instant = false;

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Private Reunification Status — ICE Alert',
    description: 'A private status page for a family reunification request.',
    path: '/ice-alerts/reunification/status',
    robots: { index: false, follow: false },
  }),
  referrer: 'no-referrer',
};

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReunificationStatusPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;
  const rawToken = params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  if (!isReunificationUuid(token)) {
    return (
      <StatusMessage
        title="This status link is incomplete."
        body="Open the exact link from your confirmation email. The link contains a private key; do not edit or shorten it."
      />
    );
  }

  const store = getReunificationStore();
  if (!store) {
    return (
      <StatusMessage
        title="Status lookup is not configured."
        body="The private request system is not fully configured on this deployment. Contact the chapter directly if you need an update."
      />
    );
  }

  let request;
  try {
    request = await findReunificationStatus(store, token);
  } catch {
    return (
      <StatusMessage
        title="Status is temporarily unavailable."
        body="The lookup could not be completed. Try again shortly, or contact the chapter using the address on the main site."
      />
    );
  }

  if (!request) {
    return (
      <StatusMessage
        title="No request matches this link."
        body="The link may be incorrect or expired. Use the exact link from your confirmation email, or contact the chapter."
      />
    );
  }

  const contactEmail = env.ADMIN_ORDER_EMAIL || 'contact@indivisiblefairoaks.org';

  return <ReunificationStatusDetails request={request} contactEmail={contactEmail} />;
}
