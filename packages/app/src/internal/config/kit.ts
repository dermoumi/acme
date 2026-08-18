// @cloudflare/workers-types declares no ImportMeta, and `cli` below needs it.
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
 * A kit is a plain object; a package exports a function taking the app's
 * options and answering one. The app lists the results in `kits`, in order.
 *
 * That function runs where the app declares it, which includes **module scope
 * in the worker**, since the app's entry imports its config. Do no work there
 * that a Worker cannot do at startup.
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
   * Where this kit's commands live, as a specifier the CLI imports. The
   * module's default export is its `KitCliMount`.
   *
   * A specifier rather than the module, because `acme.config.ts` is imported by
   * the app too and command code is node-only: importing it would drag it into
   * the worker's bundle. Written by the kit's own package, pointing at itself,
   * which needs no public export.
   *
   * **Defer it behind a function** when computing it does work, as
   * `new URL("./cli/commands.ts", import.meta.url).href` does: the app's config
   * is evaluated in the worker, where `import.meta.url` is no URL and building
   * one throws before a single request arrives.
   */
  cli?: string | (() => string);
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
