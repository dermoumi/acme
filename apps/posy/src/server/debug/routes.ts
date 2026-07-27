import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppBindings } from "../bindings";

// Deliberate failures for verifying Sentry against a real project.
export function debugRoutes(): Hono<{ Bindings: AppBindings }> {
  const routes = new Hono<{ Bindings: AppBindings }>();

  routes.get("/boom", () => {
    throw new Error("debug: server route error");
  });

  // 4xx is an expected answer, so it must NOT reach Sentry.
  routes.get("/client-error", () => {
    throw new HTTPException(418, { message: "debug: teapot" });
  });

  // 5xx is a failure, so it must.
  routes.get("/server-error", () => {
    throw new HTTPException(503, { message: "debug: unavailable" });
  });

  // Masking check: the password must arrive redacted, the username intact.
  routes.post("/credentials", async (ctx) => {
    await ctx.req.json().catch(() => null);
    throw new Error("debug: error carrying a credential body");
  });

  // Reachable without javascript, so it also covers a form post.
  routes.post("/form", () => {
    throw new Error("debug: form post error");
  });

  return routes;
}
