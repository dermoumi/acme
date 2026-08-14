// Declared here because `cli` below is what forces a kit to use it: workerd
// serves import.meta.url, but @cloudflare/workers-types declares no ImportMeta.
declare global {
  // Not readonly: @types/node declares the same property mutable, and tsc
  // refuses two declarations whose modifiers differ.
  interface ImportMeta {
    url: string;
  }
}

/**
 * One capability an app takes on, such as a database or an error reporter.
 *
 * A kit is a plain object; a package exports a function taking the app's
 * options and answering one. The app lists the results in `kits`, in order.
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
   * module's default export is its `KitMount`.
   *
   * A specifier rather than a function because `acme.config.ts` is imported by
   * the app too, and command code is node-only: a function would drag it into
   * the worker's bundle. Written by the kit's own package, pointing at itself,
   * which needs no public export: `new URL("./cli/commands.ts", import.meta.url).href`
   */
  cli?: string;
}
