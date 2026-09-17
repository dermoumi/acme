import { bound } from "../bindings";
import type {
  ClientAddress,
  GetBinding,
  Limiter,
  GetTrustedProxies,
} from "./contract";

export const clientAddress: ClientAddress = (ctx) =>
  ctx.req.header("cf-connecting-ip");

// A function has no environment to read here, and workerd ignores the ranges
// anyway. A list is still returned, so a typo in one fails this boot too.
export const getTrustedProxies: GetTrustedProxies = (configured) => {
  return typeof configured === "function" ? [] : (configured ?? []);
};

export const SELF_PROVISIONED: boolean = false;

const PERMIT_ALL: Limiter = {
  limit: () => Promise.resolve({ success: true }),
};

// Only the platform can count here, from wrangler.jsonc, so a missing binding
// leaves the route uncapped rather than failing it, which status() shows.
export const getBinding: GetBinding = (binding) => (ctx) =>
  bound(ctx.env, binding) ?? PERMIT_ALL;
