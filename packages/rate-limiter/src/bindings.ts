import type { Limiter } from "./contract";

// Cast because the app's own bindings type is not something the package knows.
export function bound(env: unknown, name: string): Limiter | undefined {
  return (env as Record<string, Limiter | undefined>)[name];
}
