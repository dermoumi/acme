// The pool ships its own types, but they pull in workers-types globals that
// clash with this app's DOM lib; declare just the surface the worker tests use.
declare module "cloudflare:test" {
  export const env: Record<string, unknown>;
}
