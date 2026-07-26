// The pool's own types resolve `env` to Cloudflare.Env, which is only populated
// by the gitignored worker-configuration.d.ts that CI never generates.
declare module "cloudflare:test" {
  export const env: Record<string, unknown>;
}
