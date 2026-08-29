import type { KitShared } from "../shared";

/**
 * What a kit reaches the other kits an app declared through.
 *
 * Not the CLI's registry, which is a separate one on `KitCli`.
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

// One app per module instance, so one pair of maps is that app's.
const appValues = new Map<string, unknown>();
const appOwners = new Map<string, string>();

// A view per kit, so both errors below can name who is at fault. Keyed by plain
// strings, since KitShared is the app's business and not this file's.
function contextFor(
  kit: string,
  values: Map<string, unknown>,
  owners: Map<string, string>,
): KitContext {
  const register = (key: string, value: unknown) => {
    const taken = owners.get(key);
    if (taken !== undefined) {
      const message = `The "${key}" value is registered by multiple kits: ${kit}, ${taken}`;
      throw new Error(message);
    }

    owners.set(key, kit);
    values.set(key, value);
  };

  const require = (key: string) => {
    if (!values.has(key)) {
      const message = `${kit} requires "${key}", which no declared kit registers`;
      throw new Error(message);
    }

    return values.get(key);
  };

  return { register, require } as KitContext;
}

export function getKitContext(kit: string): KitContext {
  return contextFor(kit, appValues, appOwners);
}

/**
 * One kit's view of a context no other kit has reached.
 *
 * For a test calling a kit's `init` by hand; an app never builds one.
 */
export function createKitContext(kit: string): KitContext {
  return contextFor(kit, new Map(), new Map());
}
