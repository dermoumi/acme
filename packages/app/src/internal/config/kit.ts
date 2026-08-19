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
   * Synchronous, and called at the worker's module scope, which cannot await.
   * What a kit needs across calls is the kit's own to hold.
   */
  init?: () => KitState;
}
