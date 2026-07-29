// The pool resolves `env` to Cloudflare.Env, which needs a generated
// worker-configuration.d.ts; this package declares its bindings in vitest.config.ts.
declare module "cloudflare:test" {
  export const env: Record<string, unknown>;
}
