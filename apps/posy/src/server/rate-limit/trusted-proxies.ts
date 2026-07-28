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

// Node reports IPv4 peers as ::ffff:10.0.0.1, so fold those back to IPv4 or they
// would never match an IPv4 CIDR.
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

/** One trusted range, reduced to the comparison a request actually needs. */
interface TrustedRange {
  v4: boolean;
  host: bigint;
  network: bigint;
}

/** Trusted proxy ranges, already parsed. Build with {@link compileTrustedProxies}. */
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

/**
 * Parses trusted proxy ranges once, ahead of any request. Accepts bare
 * addresses as well as CIDR notation. **Throws** on anything it cannot parse:
 * this is the only point where configuration is checked rather than merely
 * used, and a limiter that silently trusts nobody is worse than one that
 * refuses to start.
 */
export function compileTrustedProxies(
  cidrs: readonly string[],
): TrustedProxies {
  return cidrs.map((cidr) => {
    const compiled = compile(cidr);
    if (!compiled) {
      throw new Error(
        `not a usable trusted proxy range: ${JSON.stringify(cidr)}`,
      );
    }
    return compiled;
  });
}

/** Whether `address` falls inside any of the compiled `trusted` ranges. */
export function isTrusted(address: string, trusted: TrustedProxies): boolean {
  if (trusted.length === 0) return false;
  const parsed = parse(address);
  if (!parsed) return false;
  return trusted.some(
    (range) =>
      range.v4 === parsed.v4 && parsed.bits / range.host === range.network,
  );
}

/**
 * Resolves the client address from a request that arrived via `peer`.
 *
 * An untrusted `peer` means nothing vouched for the header, so it is ignored and
 * `peer` is used: it is the only address that cannot have been forged. Otherwise
 * the header is walked from the right, since proxies append and a client can
 * only prepend, and the first entry that is not itself a trusted proxy wins.
 *
 * Do not "simplify" that to filtering out every trusted entry and taking the
 * leftmost survivor. It is a full bypass: a client prepends a fake origin behind
 * a fake proxy address and the filter walks past the only real entry.
 */
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
