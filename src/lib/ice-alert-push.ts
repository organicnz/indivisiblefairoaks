import { generateRequestDetails, setVapidDetails } from 'web-push';
import { env } from '@/lib/env';
import type { IceAlertPushSubscription } from '@/lib/ice-alert-store';
import { PushEndpointError, validatePushEndpoint } from '@/lib/push-endpoint';
import { sendPushRequest } from '@/lib/push-transport';

export type IceAlertPushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export type IceAlertPushResult =
  | { ok: true }
  | { ok: false; status: number; gone: boolean; error: string };

let configured: boolean | null = null;

export function isIceAlertPushConfigured() {
  return Boolean(
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
  );
}

function configureWebPush() {
  if (configured === false) return false;
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }

  try {
    setVapidDetails(
      env.VAPID_SUBJECT || 'mailto:contact@indivisiblefairoaks.org',
      publicKey,
      privateKey
    );
    configured = true;
    return true;
  } catch {
    configured = false;
    return false;
  }
}

export async function sendIceAlertPush(
  subscription: IceAlertPushSubscription,
  payload: IceAlertPushPayload
): Promise<IceAlertPushResult> {
  // Revalidate immediately before sending. A URL accepted at subscribe time may
  // have been tampered with since, and a provider hostname may now resolve to a
  // private address.
  let endpoint: Awaited<ReturnType<typeof validatePushEndpoint>>;
  try {
    endpoint = await validatePushEndpoint(subscription.endpoint);
  } catch (error) {
    if (error instanceof PushEndpointError) {
      return {
        ok: false,
        status: 0,
        gone: false,
        error: `push-endpoint-${error.code}`,
      };
    }
    return {
      ok: false,
      status: 0,
      gone: false,
      error: 'push-endpoint-invalid-url',
    };
  }

  if (!configureWebPush()) {
    return {
      ok: false,
      status: 0,
      gone: false,
      error: 'web-push-not-configured',
    };
  }

  try {
    const requestDetails = generateRequestDetails(subscription, JSON.stringify(payload), {
      TTL: 900,
      urgency: 'high',
    });

    const result = await sendPushRequest({
      endpoint: endpoint.url,
      addresses: endpoint.addresses,
      headers: requestDetails.headers,
      body: requestDetails.body,
    });

    if (result.ok) return { ok: true };

    return {
      ok: false,
      status: result.status,
      gone: result.status === 404 || result.status === 410,
      error: result.error,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      gone: false,
      error: 'push-transport-error',
    };
  }
}
