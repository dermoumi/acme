import { Hono } from "hono";

const app = new Hono();

app.get("/health", (ctx) => ctx.json({ status: "ok", app: "posy" }));

export default app;
