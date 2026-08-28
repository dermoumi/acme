import type { KitShared } from "../shared";

/**
 * What a kit reaches the other kits an app declared through.
 *
 * The CLI has its own: what a kit offers a command is offered at a different
 * moment, to different readers, and neither side should drag the other along.
 */
export interface KitContext {
  /**
   * Offers a value to the other kits, under a name this kit owns.
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
   * Registering happens in `init` too, so the kit offering it has to be
   * declared ahead of this one.
   *
   * @throws If no declared kit registered that key.
   */
  require: <Key extends keyof KitShared>(key: Key) => KitShared[Key];
}

// What an app's kits hand each other. Reached only through the two methods
// below, which is what keeps the app itself from taking a kit's value. One app
// per module instance, so one map is that app's.
const values = new Map<string, unknown>();
const owner = new Map<string, string>();

// A view per kit, so both errors below can name who is at fault. Keyed by plain
// strings, since KitShared is the app's business and not this file's.
function contextFor(
  kit: string,
  held: Map<string, unknown>,
  by: Map<string, string>,
): KitContext {
  const register = (key: string, value: unknown) => {
    const taken = by.get(key);
    if (taken !== undefined) {
      const message = `The "${key}" value is registered by multiple kits: ${kit}, ${taken}`;
      throw new Error(message);
    }

    by.set(key, kit);
    held.set(key, value);
  };

  const require = (key: string) => {
    if (!held.has(key)) {
      const message = `${kit} requires "${key}", which no declared kit registers`;
      throw new Error(message);
    }

    return held.get(key);
  };

  return { register, require } as KitContext;
}

export function getKitContext(kit: string): KitContext {
  return contextFor(kit, values, owner);
}

/**
 * One kit's view of a context no other kit has reached.
 *
 * For a test calling a kit's `init` by hand, where an app has `@acme/app` hand
 * every declared kit a view of the one they share.
 */
export function createKitContext(kit: string): KitContext {
  return contextFor(kit, new Map(), new Map());
}
