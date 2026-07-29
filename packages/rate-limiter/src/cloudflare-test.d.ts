// The pool's own types resolve `env` to Cloudflare.Env, which is only populated
// by a generated worker-configuration.d.ts this package has no reason to produce.
declare module "cloudflare:test" {
  export const env: Record<string, unknown>;
}
