import type { Hono } from "hono";
import type { Handler } from "../../server/contract";

/**
 * What a kit puts on every request's context.
 *
 * Called once per environment (the bindings on workerd, the env vars on node),
 * so build values here rather than doing per-request work.
 */
export type KitVars = (env: unknown) => Record<string, unknown>;

/**
 * What a kit mounts ahead of the app's own routes.
 *
 * Unlike {@link KitRoutes}: a cap mounted behind the route it caps never runs.
 */
// oxlint-disable-next-line no-explicit-any
export type KitMiddleware = (app: Hono<any>) => void;

/**
 * What a kit adds to a built app.
 *
 * Runs behind the app's own routes, in the order the config lists the kits, so
 * a kit contributing a catch-all belongs last.
 */
// A kit's routes read the bindings its own package declares, and an app's are
// whatever it has, so neither end of this boundary can name the other's.
// oxlint-disable-next-line no-explicit-any
export type KitRoutes = (app: Hono<any>) => void;

/**
 * What a kit wraps the app's handler in, for what cannot be middleware.
 *
 * Applied in config order, so the first kit listed ends up the outermost.
 */
export type KitHandlerWrapper = (handler: Handler) => Handler;

/**
 * What a kit runs as the host leaves.
 *
 * Never called on workerd, which has no process to leave.
 */
export type KitShutdown = () => Promise<void> | void;

/**
 * What a kit's {@link Kit.init} answers.
 */
export interface KitState {
  /**
   * What this kit puts on every request's context. See {@link KitVars}.
   */
  vars?: KitVars;
  /**
   * What this kit mounts ahead of the app's routes. See {@link KitMiddleware}.
   */
  middleware?: KitMiddleware;
  /**
   * What this kit adds to the built app. See {@link KitRoutes}.
   */
  routes?: KitRoutes;
  /**
   * What this kit wraps the app's handler in. See {@link KitHandlerWrapper}.
   */
  handler?: KitHandlerWrapper;
  /**
   * What this kit runs on the way out. See {@link KitShutdown}.
   */
  shutdown?: KitShutdown;
}

/**
 * One capability an app takes on, such as a database or an error reporter.
 *
 * A package exports a function answering one; the app lists the results in
 * `kits`, in order. That function is inert: what it builds belongs in
 * {@link Kit.init}, since a config is read on build machines too.
 */
export interface Kit {
  /**
   * The specifier an app imports this kit's package by. A kit an app declares
   * in its own config takes that app's name.
   */
  name: string;
  /**
   * What the app declared, for whoever reads it back.
   *
   * The kit's own code is the only thing that knows this shape, so it is
   * `unknown` here and cast where the type is known. It reaches the kit's
   * commands, and an app can read it straight off the config it imported.
   */
  config?: unknown;
  /**
   * Where this kit's commands live, as a specifier the CLI imports. The
   * module's default export is its `KitCommandsMount`.
   *
   * Absent means this kit has none; present means it must resolve, or the CLI
   * fails saying whose did not.
   */
  commands?: string;
  /**
   * Where this kit's vite plugins live, as a specifier `@acme/app` imports.
   * The module's default export is its `KitVite`.
   *
   * Declared like {@link Kit.commands}, and resolved the same way.
   */
  vite?: string;
  /**
   * The kits this one needs the app to declare too, by {@link Kit.name}.
   *
   * Checked, never acted on: what a kit needs says nothing about where it
   * belongs in `kits`, which is the app's to decide.
   */
  requires?: string[];
  /**
   * Builds what this kit holds, and answers it. See {@link KitState}.
   *
   * Synchronous, and called at the worker's module scope, which cannot await.
   * Called once per declared kit, however many slots read what it answered.
   */
  init?: () => KitState;
}
