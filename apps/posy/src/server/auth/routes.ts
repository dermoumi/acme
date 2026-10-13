import type { Context } from "hono";
import { Hono } from "hono";
import type { AppEnv } from "../bindings";
import { getSessionUser, signIn, signOut } from "./account";

interface LoginBody {
  username: string | null;
  password: string | null;
  clientVersion: string | null;
}

function parseLoginBody(body: unknown): LoginBody {
  if (typeof body !== "object" || body === null) {
    return { username: null, password: null, clientVersion: null };
  }
  const record = body as Record<string, unknown>;
  return {
    username:
      typeof record.username === "string" && record.username
        ? record.username
        : null,
    password:
      typeof record.password === "string" && record.password
        ? record.password
        : null,
    clientVersion:
      typeof record.clientVersion === "string" ? record.clientVersion : null,
  };
}

async function handleLogin(ctx: Context<AppEnv>): Promise<Response> {
  const { username, password, clientVersion } = parseLoginBody(
    await ctx.req.json().catch(() => null),
  );
  const session =
    username && password
      ? await signIn(ctx, username, password, clientVersion)
      : null;
  if (!session) return ctx.json({ error: "invalid_credentials" }, 401);

  ctx.header("Set-Cookie", session.cookie);
  return ctx.json({ user: session.user });
}

export function authRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get("/", async (ctx) => {
    return ctx.json({ user: await getSessionUser(ctx) });
  });

  routes.post("/", (ctx) => handleLogin(ctx));

  routes.delete("/", async (ctx) => {
    ctx.header("Set-Cookie", await signOut(ctx));
    return ctx.body(null, 204);
  });

  return routes;
}
