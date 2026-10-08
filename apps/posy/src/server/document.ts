import type { Context } from "hono";
import { createRequestHandler } from "react-router";

const handleRequest = createRequestHandler(
  async () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export async function renderDocument(ctx: Context): Promise<Response> {
  return handleRequest(ctx.req.raw);
}
