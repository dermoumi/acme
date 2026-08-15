import { env } from "cloudflare:test";

// The pool's ASSETS binding, pointed at the same fixture the node arm serves.
export const assetsEnv: unknown = env;
