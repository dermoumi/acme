import type { KitShared } from "../internal/shared";

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
  register: <Key extends keyof KitShared>(
    key: Key,
    value: KitShared[Key],
  ) => void;
  /**
   * Takes what another kit registered, typed by whoever registered it.
   *
   * Call this inside a command's action, never while mounting: every kit has
   * registered by then, so the order an app lists its kits in stays its own
   * business rather than something a kit has to get right.
   *
   * @throws If no declared kit registered that key.
   */
  require: <Key extends keyof KitShared>(key: Key) => KitShared[Key];
}

// A view per kit, so both errors below can name who is at fault. The store is
// keyed by plain strings: KitShared is whatever the app's kits merged into it,
// which this never needs to know.
export function kitRegistry(): (kit: string) => KitRegistry {
  const values = new Map<string, unknown>();
  const owner = new Map<string, string>();

  return (kit) => {
    const register = (key: string, value: unknown) => {
      const taken = owner.get(key);
      if (taken !== undefined) {
        const message = `The "${key}" value is registered by multiple kits: ${kit}, ${taken}`;
        throw new Error(message);
      }

      owner.set(key, kit);
      values.set(key, value);
    };

    const require = (key: string) => {
      if (!values.has(key)) {
        const message = `${kit} requires "${key}", which no declared kit registers`;
        throw new Error(message);
      }

      return values.get(key);
    };

    return { register, require } as KitRegistry;
  };
}
