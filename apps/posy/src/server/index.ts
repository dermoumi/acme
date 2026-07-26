import { D1Dialect } from "kysely-d1";
import { createApp } from "./app";

const app = createApp((env) => {
  if (!env.DB) throw new Error("no D1 binding on this environment");
  return new D1Dialect({ database: env.DB });
});

export default app;
