import type { MiddlewareHandler } from "hono";
import { basicAuth } from "hono/basic-auth";
import { HTTPException } from "hono/http-exception";

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

export function gate(): MiddlewareHandler<{ Bindings: GateBindings }> {
  return async (ctx, next) => {
    if (!ctx.env.REQUIRE_AUTH) return next();

    const [first, ...rest] = parseUsers(ctx.env.BASIC_AUTH);
    if (!first) {
      return ctx.text("service unavailable", 503, {
        "X-Robots-Tag": "noindex",
      });
    }

    try {
      if (ctx.req.path === "/health") {
        await next();
      } else {
        await basicAuth({ realm: "Posy Staging", ...first }, ...rest)(
          ctx,
          next,
        );
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
