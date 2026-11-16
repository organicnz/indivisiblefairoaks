export const ICE_ALERT_SERVICE_WORKER = '/ice-alert-sw.js';

export type BrowserPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || '';
}

/** VAPID keys are URL-safe base64; PushManager needs the raw bytes. */
export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

function toSubscriptionJson(
  subscription: PushSubscription
): BrowserPushSubscription {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error('This browser returned an incomplete push subscription.');
  }
  return { endpoint: json.endpoint, keys: { p256dh, auth } };
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  return navigator.serviceWorker.register(ICE_ALERT_SERVICE_WORKER, {
    scope: '/',
  });
}

export async function currentPushSubscription(): Promise<BrowserPushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) return null;
  const subscription = await reg.pushManager.getSubscription();
  return subscription ? toSubscriptionJson(subscription) : null;
}

export async function enablePushAlerts(): Promise<BrowserPushSubscription> {
  if (!isPushSupported()) {
    throw new Error('Phone alerts are not supported in this browser.');
  }
  const publicKey = pushPublicKey();
  if (!publicKey) {
    throw new Error('Phone alerts are not configured on this deployment.');
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();
  if (existing) return toSubscriptionJson(existing);

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  return toSubscriptionJson(subscription);
}

export async function disablePushAlerts() {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) return;
  const subscription = await reg.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
}
