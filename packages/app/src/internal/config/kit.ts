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
   * Where this kit's commands live, as a specifier the CLI imports. The
   * module's default export is its `KitCommandsMount`.
   *
   * ```ts
   * commands: "@acme/db/commands",
   * ```
   *
   * Absent means this kit has none and nothing is attempted; present means it
   * must resolve, or the CLI fails saying whose did not.
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
   * What a kit needs across calls is the kit's own to hold.
   */
  init?: () => KitState;
}
