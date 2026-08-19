import type { Context } from "hono";
import type { AppEnv } from "../bindings";
import type { GateBindings } from "../gate";

/**
 * What Workers get from the platform and a node process has to build itself.
 */
export interface Platform {
  /**
   * Where static files come from: the binding on workerd, the filesystem on
   * node unless something bound one. Until an assets kit owns this.
   */
  assets: (ctx: Context<AppEnv>) => GateBindings["ASSETS"];
}
