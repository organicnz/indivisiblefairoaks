import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_ENDPOINT_LENGTH = 2_048;

/**
 * Browser push endpoints are issued by a small set of push services. Keeping
 * this list explicit is deliberate: accepting an arbitrary HTTPS URL turns the
 * notification sender into an SSRF primitive.
 */
const PUSH_PROVIDER_HOSTS = new Set([
  'android.googleapis.com',
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]);

/** WNS issues per-region endpoints under a shared zone. */
const PUSH_PROVIDER_SUFFIXES = ['notify.windows.com'];

const IPV4_BLOCKS: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

export type PushEndpointAddress = {
  address: string;
  family: 4 | 6;
};

export type PushEndpointResolver = (
  hostname: string
) => Promise<PushEndpointAddress[]>;

export type PushEndpointErrorCode =
  | 'invalid-url'
  | 'insecure-protocol'
  | 'credentials-not-allowed'
  | 'nonstandard-port'
  | 'fragment-not-allowed'
  | 'private-destination'
  | 'provider-not-allowed'
  | 'dns-failed';

export class PushEndpointError extends Error {
  readonly code: PushEndpointErrorCode;

  constructor(code: PushEndpointErrorCode, message: string) {
    super(message);
    this.name = 'PushEndpointError';
    this.code = code;
  }
}

function fail(code: PushEndpointErrorCode, message: string): never {
  throw new PushEndpointError(code, message);
}

function ipv4ToNumber(value: string): number | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    result = result * 256 + octet;
  }
  return result;
}

function isPrivateIpv4(value: string): boolean {
  const address = ipv4ToNumber(value);
  if (address === null) return true;

  return IPV4_BLOCKS.some(([network, prefix]) => {
    const base = ipv4ToNumber(network);
    if (base === null) return true;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (address & mask) === (base & mask);
  });
}

function parseIpv6(value: string): bigint | null {
  let input = value.toLowerCase();

  // URL hostnames can carry an IPv6 zone id. DNS answers do not, and a zone id
  // is a link-local hint, so treat it as invalid instead of stripping it.
  if (input.includes('%')) return null;

  // Convert an embedded IPv4 tail (e.g. ::ffff:127.0.0.1) into two hex groups.
  if (input.includes('.')) {
    const lastColon = input.lastIndexOf(':');
    if (lastColon < 0) return null;
    const ipv4 = ipv4ToNumber(input.slice(lastColon + 1));
    if (ipv4 === null) return null;
    const high = Math.floor(ipv4 / 65_536).toString(16);
    const low = (ipv4 % 65_536).toString(16);
    input = `${input.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = input.split('::');
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;

  const groups = [
    ...left,
    ...Array.from({ length: missing }, () => '0'),
    ...right,
  ];
  if (groups.length !== 8) return null;

  let result = 0n;
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    result = (result << 16n) + BigInt(Number.parseInt(group, 16));
  }
  return result;
}

function isPrivateIpv6(value: string): boolean {
  const address = parseIpv6(value);
  if (address === null) return true;

  // Unspecified, loopback, IPv4-compatible and IPv4-mapped addresses. Blocking
  // the mapped range wholesale prevents a mapped private address from slipping
  // past the IPv4 checks.
  if (address >> 32n === 0n) return true;
  if (address >> 32n === 0xffffn) return true;

  // IPv4-translated addresses (RFC 2765) use ::ffff:0:0:0/96, a different
  // prefix from IPv4-mapped. Block the whole range, including translations of
  // public IPv4 addresses, because the wrapper is non-public.
  if (address >> 32n === 0xffff0000n) return true;

  const top8 = Number(address >> 120n);
  if (top8 === 0xfc || top8 === 0xfd) return true; // unique local fc00::/7

  const top16 = Number(address >> 112n);
  if (top16 >= 0xfe80 && top16 <= 0xfebf) return true; // link local fe80::/10
  if (top16 >= 0xfec0 && top16 <= 0xfeff) return true; // deprecated site local
  if (top16 >= 0xff00) return true; // multicast ff00::/8

  if (address >> 112n === 0x2002n) return true; // 6to4
  if (address >> 96n === 0x20010000n) return true; // Teredo 2001::/32
  if (address >> 96n === 0x20010db8n) return true; // documentation 2001:db8::/32
  if (address >> 64n === 0x0100000000000000n) return true; // discard-only 100::/64
  if (address >> 32n === 0x64ff9b0000000000000000n) return true; // NAT64 well-known
  if (address >> 80n === 0x64ff9b0001n) return true; // NAT64 local-use 64:ff9b:1::/48

  return false;
}

/** Fail closed for malformed addresses and block non-public destinations. */
export function isPrivateOrInternalAddress(value: string): boolean {
  const version = isIP(value);
  if (version === 4) return isPrivateIpv4(value);
  if (version === 6) return isPrivateIpv6(value);
  return true;
}

export function isKnownPushProviderHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (PUSH_PROVIDER_HOSTS.has(host)) return true;

  return PUSH_PROVIDER_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

async function resolvePushHost(hostname: string): Promise<PushEndpointAddress[]> {
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.flatMap((record) =>
      record.family === 4 || record.family === 6
        ? [{ address: record.address, family: record.family }]
        : []
    );
  } catch {
    fail('dns-failed', 'The push endpoint could not be resolved.');
  }
}

/**
 * Validate a browser-issued push endpoint and return the resolved addresses.
 *
 * The addresses are passed to the transport so the request connects to the
 * address that was checked here, rather than resolving the hostname again and
 * creating a DNS-rebinding window.
 */
export async function validatePushEndpoint(
  rawEndpoint: string,
  resolver: PushEndpointResolver = resolvePushHost
): Promise<{ url: URL; addresses: PushEndpointAddress[] }> {
  if (rawEndpoint.length === 0 || rawEndpoint.length > MAX_ENDPOINT_LENGTH) {
    fail('invalid-url', 'The push endpoint is not a valid URL.');
  }

  let url: URL;
  try {
    url = new URL(rawEndpoint);
  } catch {
    fail('invalid-url', 'The push endpoint is not a valid URL.');
  }

  if (url.protocol !== 'https:') {
    fail('insecure-protocol', 'Push endpoints must use HTTPS.');
  }
  if (url.username || url.password) {
    fail('credentials-not-allowed', 'Push endpoints cannot contain credentials.');
  }
  if (url.port && url.port !== '443') {
    fail('nonstandard-port', 'Push endpoints must use port 443.');
  }
  if (url.hash) {
    fail('fragment-not-allowed', 'Push endpoints cannot contain a fragment.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname) fail('invalid-url', 'The push endpoint has no host.');

  if (isIP(hostname) !== 0) {
    if (isPrivateOrInternalAddress(hostname)) {
      fail('private-destination', 'The push endpoint points to a private address.');
    }
    fail('provider-not-allowed', 'The push endpoint is not a known push provider.');
  }

  if (!isKnownPushProviderHost(hostname)) {
    fail('provider-not-allowed', 'The push endpoint is not a known push provider.');
  }

  let addresses: PushEndpointAddress[];
  try {
    addresses = await resolver(hostname);
  } catch {
    fail('dns-failed', 'The push endpoint could not be resolved.');
  }
  if (addresses.length === 0) {
    fail('dns-failed', 'The push endpoint could not be resolved.');
  }
  if (addresses.some(({ address }) => isPrivateOrInternalAddress(address))) {
    fail('private-destination', 'The push endpoint resolves to a private address.');
  }

  return { url, addresses };
}
