// The pool's own types resolve env to Cloudflare.Env, which needs a generated
// worker-configuration.d.ts this package has no reason to produce.
declare module "cloudflare:test" {
  export function createExecutionContext(): ExecutionContext;
  export function waitOnExecutionContext(ctx: ExecutionContext): Promise<void>;
}
