// Named in the `types` of every tsconfig whose files import the id: a program
// only sees the ambient modules it lists, and no reference directive reaches it.
declare module "virtual:acme-config" {
  const config: import("./internal/config").AcmeConfig;

  /**
   * Turns a specifier the app wrote in its config into one that can be
   * imported.
   */
  export function resolve(specifier: string): string;

  export default config;
}
