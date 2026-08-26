import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";
import { MemoryStore, type Store } from "hono-rate-limiter";
import { bound } from "../bindings";
import type { ClientAddress, GetBinding, Limiter } from "./contract";
import { resolveClientAddress } from "../trusted-proxies";

// No real config to pass: the middleware never runs here, and stores read
// windowMs.
type StoreConfig = Parameters<NonNullable<Store["init"]>>[0];

function peerAddress(ctx: Context): string | undefined {
  try {
    return getConnInfo(ctx).remote.address;
  } catch {
    // Reads node's IncomingMessage, so it throws unless the request came
    // through @hono/node-server.
    return undefined;
  }
}

export const clientAddress: ClientAddress = (ctx, trustedProxies) => {
  const peer = peerAddress(ctx as Context);
  if (!peer) return;

  const forwarded = ctx.req.header("x-forwarded-for");

  return resolveClientAddress(peer, forwarded, trustedProxies);
};

export const SELF_PROVISIONED: boolean = true;

// Nothing needs binding here: the budget itself is enforced, in memory and per
// process. A bound limiter still wins, so an entrypoint can supply a shared one.
export const getBinding: GetBinding = (binding, limit, periodSeconds) => {
  const store: Store = new MemoryStore();
  store.init?.({ windowMs: periodSeconds * 1000, limit } as StoreConfig);

  const provisioned: Limiter = {
    // Awaited because a shared store is a round trip, unlike the memory one.
    limit: async ({ key }) => {
      const { totalHits } = await store.increment(key);
      return { success: totalHits <= limit };
    },
  };

  return (ctx) => bound(ctx.env, binding) ?? provisioned;
};
