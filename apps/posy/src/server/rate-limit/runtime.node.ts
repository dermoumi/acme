import { getConnInfo } from "@hono/node-server/conninfo";
import { MemoryStore } from "hono-rate-limiter";
import type { ClientKey, CreateLimiter } from "./contract";
import { resolveClientAddress } from "./trusted-proxies";

// getConnInfo reads node's IncomingMessage, absent unless the request came
// through @hono/node-server; unidentifiable callers then share one budget.
function peerAddress(ctx: Parameters<ClientKey>[0]): string | undefined {
  try {
    return getConnInfo(ctx).remote.address;
  } catch {
    return undefined;
  }
}

// Keyed on IP, never username: per-username buckets let anyone lock a user out.
export const clientKey: ClientKey = (ctx, { trustedProxies }) => {
  const peer = peerAddress(ctx);
  if (!peer) return "unknown";
  return resolveClientAddress(
    peer,
    ctx.req.header("x-forwarded-for"),
    trustedProxies,
  );
};

export const SELF_PROVISIONED: boolean = true;

/**
 * Builds the limiter from the policy's own budget, so a node app needs nothing
 * bound: what `createApp` was given is what gets enforced. Counting defaults to
 * memory, which is per replica; pass `RedisStore` to share it across them.
 */
export const createLimiter: CreateLimiter = (
  policy,
  store = new MemoryStore(),
) => {
  // Optional on the Store contract, and reads windowMs off the middleware
  // config, which is the only field any bundled store looks at.
  store.init?.({ windowMs: policy.periodSeconds * 1000 } as Parameters<
    NonNullable<typeof store.init>
  >[0]);

  return {
    // Awaited because a shared store is a round trip, unlike the memory one.
    limit: async ({ key }) => {
      const { totalHits } = await store.increment(key);
      return { success: totalHits <= policy.limit };
    },
  };
};
