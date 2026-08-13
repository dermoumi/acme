/** The engine an app's server code is running on. */
export type RuntimeName = "node" | "workerd";

/**
 * What every arm of the `#runtime` seam provides. Only the name so far: the
 * seam is here ahead of its first real use because the conditional exports and
 * the tsconfig projects behind it are the part that is easy to get wrong.
 */
export interface Runtime {
  name: RuntimeName;
}
