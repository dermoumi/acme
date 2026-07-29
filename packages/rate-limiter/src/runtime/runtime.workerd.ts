import { bound } from "../bindings";
import type { ClientAddress, GetBinding, Limiter } from "./contract";

export const clientAddress: ClientAddress = (ctx) =>
  ctx.req.header("cf-connecting-ip");

export const SELF_PROVISIONED: boolean = false;

const PERMIT_ALL: Limiter = {
  limit: () => Promise.resolve({ success: true }),
};

// Only the platform can count here, from wrangler.jsonc, so a missing binding
// leaves the route uncapped rather than failing it. status() is what shows that.
export const getBinding: GetBinding = (binding) => (ctx) =>
  bound(ctx.env, binding) ?? PERMIT_ALL;
