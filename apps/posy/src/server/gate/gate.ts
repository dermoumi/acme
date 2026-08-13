import type { MiddlewareHandler } from "hono";
import { basicAuth } from "hono/basic-auth";
import { HTTPException } from "hono/http-exception";

/** What the gate reads off the environment to decide whether to challenge. */
export interface GateBindings {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  REQUIRE_AUTH?: string;
  BASIC_AUTH?: string;
}

interface User {
  username: string;
  password: string;
}

// One "user:pass" per line; split on the first colon (passwords may contain colons).
// Any malformed line invalidates the whole secret so a typo fails closed, not open.
function parseUsers(raw: string | undefined): User[] {
  const users: User[] = [];
  for (const line of (raw ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon < 1) return [];
    users.push({
      username: trimmed.slice(0, colon),
      password: trimmed.slice(colon + 1),
    });
  }
  return users;
}

/** Per-app wiring for {@link gate}. Everything here is optional. */
export interface GateOptions {
  /**
   * Paths that skip the credentials check but still pass through the gate, so
   * they keep its noindex header and its 503 when the secret is unusable.
   * Whatever is listed is world-readable on a gated tier.
   */
  open?: readonly string[];

  /**
   * What the browser's credential prompt calls this deployment. Cosmetic: it
   * labels the challenge and scopes cached credentials, and the server never
   * reads back what a client sends.
   */
  realm?: string;
}

/**
 * Keeps a deployment private, and out of search results while it is.
 *
 * Inert until `REQUIRE_AUTH` is set, so production mounts it and pays nothing.
 * Once set it demands basic auth against `BASIC_AUTH`, one `user:pass` per
 * line, and stamps `X-Robots-Tag: noindex` on everything it lets through.
 *
 * Fails closed: a secret it cannot parse answers 503 everywhere rather than
 * opening the tier, and that includes the paths named in `open`, so a probe
 * cannot report a deployment healthy while nobody can reach it.
 *
 * Mount it first. It wraps whatever comes after, and the assets catch-all has
 * to be inside it.
 *
 * @param options Open paths and the realm, both app-specific.
 */
export function gate(
  options: GateOptions = {},
): MiddlewareHandler<{ Bindings: GateBindings }> {
  const open = new Set(options.open);
  const realm = options.realm ?? "Staging";

  return async (ctx, next) => {
    if (!ctx.env.REQUIRE_AUTH) return next();

    const [first, ...rest] = parseUsers(ctx.env.BASIC_AUTH);
    if (!first) {
      return ctx.text("service unavailable", 503, {
        "X-Robots-Tag": "noindex",
      });
    }

    try {
      if (open.has(ctx.req.path)) {
        await next();
      } else {
        await basicAuth({ realm, ...first }, ...rest)(ctx, next);
      }
    } catch (error) {
      if (!(error instanceof HTTPException)) throw error;
      const res = error.getResponse();
      res.headers.set("X-Robots-Tag", "noindex");
      return res;
    }
    // Binding fetch responses (assets) have immutable headers; rewrap to stamp.
    ctx.res = new Response(ctx.res.body, ctx.res);
    ctx.res.headers.set("X-Robots-Tag", "noindex");
  };
}
