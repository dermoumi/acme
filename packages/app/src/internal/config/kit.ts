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
 * One capability an app takes on, such as a database or an error reporter.
 *
 * A package exports a function answering one; the app lists the results in
 * `kits`, in order. That function runs at **module scope in the worker**, since
 * the entry imports its config, so do nothing there a Worker cannot do.
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
   * What this kit puts on every request's context. See {@link KitVars}.
   */
  vars?: KitVars;
  /**
   * What this kit made of `config` when it was declared — connections it
   * opened, a compiled matcher — for its own other parts to read back.
   *
   * `unknown` because only the kit knows the shape, as with `config`.
   */
  context?: unknown;
}
