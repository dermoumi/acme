import { Hono } from "hono";

const app = new Hono();

app.get("/api/health", (ctx) => ctx.json({ status: "ok", app: "posy" }));

export default app;
