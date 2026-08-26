import {
  convertIPv4MappedIPv6ToIPv4,
  convertIPv4ToBinary,
  convertIPv6ToBinary,
  distinctRemoteAddr,
  isIPv4MappedIPv6,
} from "hono/utils/ipaddr";

interface Address {
  v4: boolean;
  bits: bigint;
}

// Node reports IPv4 peers as ::ffff:10.0.0.1, so fold those back or they would
// never match an IPv4 CIDR.
function parse(text: string): Address | undefined {
  try {
    const type = distinctRemoteAddr(text);
    if (type === "IPv4") return { v4: true, bits: convertIPv4ToBinary(text) };
    if (type !== "IPv6") return undefined;

    const bits = convertIPv6ToBinary(text);
    return isIPv4MappedIPv6(bits)
      ? { v4: true, bits: convertIPv4MappedIPv6ToIPv4(bits) }
      : { v4: false, bits };
  } catch {
    return undefined;
  }
}

// One trusted range, reduced to the comparison a request actually needs.
interface TrustedRange {
  v4: boolean;
  host: bigint;
  network: bigint;
}

export type TrustedProxies = readonly TrustedRange[];

function compile(cidr: string): TrustedRange | undefined {
  const [range, prefixText] = cidr.split("/");
  const target = range === undefined ? undefined : parse(range);
  if (!target) return undefined;

  const width = target.v4 ? 32 : 128;
  // Guard the digits before Number(), which reads "" and " " as 0, and a zero
  // prefix matches every address: a trailing slash would trust the whole family.
  if (prefixText !== undefined && !/^\d+$/u.test(prefixText)) return undefined;

  const prefix = prefixText === undefined ? width : Number(prefixText);
  if (prefix > width) return undefined;

  const host = 2n ** BigInt(width - prefix);
  return { v4: target.v4, host, network: target.bits / host };
}

// Throws on anything it cannot parse: a limiter that silently trusts nobody is
// worse than one that refuses to start.
export function compileTrustedProxies(
  cidrs: readonly string[],
): TrustedProxies {
  return cidrs.map((cidr) => {
    const compiled = compile(cidr);
    if (!compiled) {
      const message = `not a usable trusted proxy range: ${JSON.stringify(cidr)}`;
      throw new Error(message);
    }
    return compiled;
  });
}

export function isTrusted(address: string, trusted: TrustedProxies): boolean {
  if (trusted.length === 0) return false;
  const parsed = parse(address);
  if (!parsed) return false;

  return trusted.some(
    (range) =>
      range.v4 === parsed.v4 && parsed.bits / range.host === range.network,
  );
}

// An untrusted peer's header is ignored: the peer is the only address that
// cannot be forged. Walk from the right, since a client can only prepend.
export function resolveClientAddress(
  peer: string,
  forwardedFor: string | undefined,
  trustedProxies: TrustedProxies,
): string {
  if (!isTrusted(peer, trustedProxies)) return peer;

  const hops = (forwardedFor ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return hops.findLast((hop) => !isTrusted(hop, trustedProxies)) ?? peer;
}
