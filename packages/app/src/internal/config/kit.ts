// @cloudflare/workers-types declares no ImportMeta; `commands` below needs it.
declare global {
  interface ImportMeta {
    url: string;
  }
}

/**
 * What a kit puts on every request's context.
 *
 * ```ts
 * vars: (env) => ({ getDb: (name) => open(name, env) })
 * ```
 *
 * Run per request with the bindings on workerd, or the environment variables
 * on node.
 */
export type KitVars = (env: unknown) => Record<string, unknown>;

/**
 * What a kit's {@link Kit.init} answers.
 *
 * What a kit builds for its OWN other parts stays the kit's, held wherever it
 * likes: handing it back here would make one kit's private state something
 * anyone holding the app's config could read.
 */
export interface KitState {
  /**
   * What this kit puts on every request's context. See {@link KitVars}.
   */
  vars?: KitVars;
}

/**
 * One capability an app takes on, such as a database or an error reporter.
 *
 * A package exports a function answering one; the app lists the results in
 * `kits`, in order. That function is **inert**: it may check what it was
 * handed, but everything it builds belongs in {@link Kit.init}, because a
 * config is read on a build machine as well as inside the worker.
 */
export interface Kit {
  /** Names the kit when something goes wrong. Conventionally the package's short name. */
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
   * Answers where this kit's commands live, as a specifier the CLI imports.
   * The module's default export is its `KitCliMount`.
   *
   * ```ts
   * commands: () => new URL("./cli/commands.ts", import.meta.url).href,
   * ```
   *
   * A specifier, so node-only command code stays out of the worker's bundle.
   * A function, because naming it is work: `import.meta.url` is no URL in a
   * worker, and building one throws before any request arrives.
   */
  commands?: () => string;
  /**
   * Builds what this kit holds, and answers it. See {@link KitState}.
   *
   * ```ts
   * init: () => ({ vars: (env) => ({ getDb: open(config, env) }) }),
   * ```
   *
   * Run once, where the app is served: `serve` mounts the middleware that asks
   * for it at the worker's module scope. What a kit needs to survive a second
   * call is the kit's to hold.
   *
   * Synchronous, since that module scope cannot await.
   */
  init?: () => KitState;
}
