import { getConnInfo } from "@hono/node-server/conninfo";
import { MemoryStore } from "hono-rate-limiter";
import type { ClientKey, Limiter } from "./contract";
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

/**
 * An in-process limiter for node entrypoints, counting in memory.
 *
 * Counts are per process, so replicas each get their own budget; swap in a
 * shared `hono-rate-limiter` store such as `RedisStore` once that matters.
 */
export function createMemoryLimiter(options: {
  limit: number;
  windowMs: number;
}): Limiter {
  const store = new MemoryStore();
  // init() reads windowMs and nothing else off the middleware config.
  store.init({ windowMs: options.windowMs } as Parameters<
    typeof store.init
  >[0]);

  return {
    limit: ({ key }) => {
      const { totalHits } = store.increment(key);
      return Promise.resolve({ success: totalHits <= options.limit });
    },
  };
}
