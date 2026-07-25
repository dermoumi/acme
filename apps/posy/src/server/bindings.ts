import type { D1Database } from "@cloudflare/workers-types";
import type { GateBindings } from "./gate";

// DB is optional: cloud environments have no D1 binding until the follow-up task.
export interface AppBindings extends GateBindings {
  DB?: D1Database;
}
