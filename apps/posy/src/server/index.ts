import { Hono } from "hono";
import { gate, type GateBindings } from "./gate";

const app = new Hono<{ Bindings: GateBindings }>();

app.use(gate());

app.get("/health", (ctx) => ctx.json({ status: "ok", app: "posy" }));

// Under run_worker_first the worker fronts every request; the assets binding
// applies the configured SPA not_found_handling itself.
app.all("*", (ctx) => ctx.env.ASSETS.fetch(ctx.req.raw));

export default app;
