// Reached by reference directive, never a tsconfig `types` entry: a file
// importing the id needs its own `/// <reference types="@acme/app/types" />`.
declare module "virtual:acme-config" {
  const config: import("./internal/config").AcmeConfig;

  /**
   * Turns a specifier the app wrote in its config into one that can be
   * imported.
   */
  export function resolve(specifier: string): string;

  export default config;
}
