// The pool resolves `env` to Cloudflare.Env, which needs a generated
// worker-configuration.d.ts; bindings are declared in vitest.config.ts instead.
declare module "cloudflare:test" {
  export const env: Record<string, unknown>;
}
