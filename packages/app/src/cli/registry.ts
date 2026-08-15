/** What a kit reaches the other kits an app declared through. */
export interface KitRegistry {
  /**
   * Offers a value to the other kits, under a name this kit owns.
   *
   * Call this while mounting, which is the only time every kit is guaranteed
   * to still be ahead of any command running.
   *
   * @throws If another kit already registered that key.
   */
  register(key: string, value: unknown): void;
  /**
   * Takes what another kit registered, cast to what the caller says it is.
   *
   * Call this inside a command's action, never while mounting: every kit has
   * registered by then, so the order an app lists its kits in stays its own
   * business rather than something a kit has to get right.
   *
   * @throws If no declared kit registered that key.
   */
  require<Value>(key: string): Value;
}

/**
 * Opens a registry, and answers one kit's view of it.
 *
 * `mountCommands` calls this for the `acme` CLI. Anything else mounting a kit's
 * commands itself, such as a kit's own bin, needs one too: each view knows
 * which kit holds it, so both errors below can name who is at fault.
 */
export function kitRegistry(): (kit: string) => KitRegistry {
  const values = new Map<string, unknown>();
  const owner = new Map<string, string>();

  return (kit) => ({
    register(key, value) {
      const taken = owner.get(key);
      if (taken !== undefined) {
        throw new Error(`${kit} and ${taken} both register "${key}"`);
      }

      owner.set(key, kit);
      values.set(key, value);
    },
    require<Value>(key: string): Value {
      if (!values.has(key)) {
        throw new Error(
          `${kit} requires "${key}", which no declared kit registers`,
        );
      }

      return values.get(key) as Value;
    },
  });
}
