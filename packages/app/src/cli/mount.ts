import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { CAC } from "cac";
import type { Kit } from "../internal/config";
import type { KitShared } from "../internal/shared";

/**
 * The part of the `acme` CLI a kit is handed: enough to declare its own
 * commands, and nothing that would let it rename the program or its help.
 */
export type KitCommands = Pick<CAC, "command">;

/**
 * What a kit reaches the other kits an app declared through.
 */
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

/**
 * What a kit's `commands` module is handed when mounted.
 */
export interface KitCli extends KitRegistry {
  cli: KitCommands;
  /** The kit's own config, as the app declared it. */
  config: unknown;
  /**
   * Turns a specifier the app wrote in its config into one that can be
   * imported, so a kit taking paths never has to ask where the config is.
   *
   * Relative to the config file, because that is what the app wrote it
   * relative to. An absolute specifier is answered unchanged, which is what a
   * kit pointing at itself with `import.meta.url` produces.
   *
   * @throws If the app's config never came from a file, leaving nothing to be
   *   relative to.
   */
  resolve: (specifier: string) => string;
}

/**
 * What a kit's `commands` module default-exports.
 *
 * Declaring commands is synchronous; an action that needs to reach a database
 * or the network does that when it runs, not while the CLI is being built.
 */
export type KitCommandsMount = (context: KitCli) => void;

// A view per kit, so both errors below can name who is at fault. Keyed by
// plain strings, since KitShared is the app's business and not this file's.
function kitRegistry(): (kit: string) => KitRegistry {
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

type Resolve = (specifier: string) => string;

async function loadMount(
  kit: Kit,
  resolve: Resolve,
): Promise<KitCommandsMount | undefined> {
  const { commands } = kit;
  if (commands === undefined) {
    return undefined;
  }

  const importCommands = async () => {
    try {
      return (await import(resolve(commands))) as {
        default?: KitCommandsMount;
      };
    } catch (cause: unknown) {
      const message = `Commands module from ${kit.name} cannot be loaded.`;
      throw new Error(message, { cause });
    }
  };

  const { default: cliMount } = await importCommands();
  if (!cliMount) {
    const message = `${kit.name}'s commands module must export its mount as default`;
    throw new Error(message);
  }

  return cliMount;
}

function resolverFor(configUrl: string | undefined): Resolve {
  return (specifier) => {
    if (URL.canParse(specifier)) {
      return specifier;
    }

    if (configUrl === undefined) {
      const message = `cannot resolve "${specifier}": no config file was read`;
      throw new Error(message);
    }

    if (specifier.startsWith(".")) {
      return new URL(specifier, configUrl).href;
    }

    // Node's resolver, run from the app: @acme/app declares no kit, so looking
    // for one beside itself finds nothing under pnpm.
    const specifierPath = createRequire(configUrl).resolve(specifier);
    return pathToFileURL(specifierPath).href;
  };
}

function checkRequires(kits: Kit[]): void {
  const declared = new Set(kits.map((kit) => kit.name));

  for (const kit of kits) {
    const missing = (kit.requires ?? []).find((one) => !declared.has(one));
    if (missing !== undefined) {
      const message = `${kit.name} requires ${missing}, which this app does not declare`;
      throw new Error(message);
    }
  }
}

/**
 * Mounts every kit's commands onto the CLI, in the order the app declared.
 *
 * @param cli - The CLI being built, with its own commands already on it.
 * @param kits - The app's kits. Those declaring no `commands` add nothing.
 * @param configUrl - Where the app's config was read from, which specifiers
 *   inside it resolve against. Absent when the caller passed a config in hand.
 * @throws If a kit requires one the app does not declare, if a kit's module
 *   cannot be loaded, or if two kits register the same command or shared key,
 *   either of which would otherwise resolve silently to whichever came first.
 */
export async function mountCommands(
  cli: CAC,
  kits: Kit[],
  configUrl?: string,
): Promise<void> {
  const owner = new Map(cli.commands.map((cmd) => [cmd.name, cli.name]));
  const registryFor = kitRegistry();
  const resolve = resolverFor(configUrl);
  checkRequires(kits);
  // Loaded up front so one slow import does not hold up the rest, then
  // mounted in order, because that order is what the app declared.
  const mounts = await Promise.all(
    kits.map(async (kit) => loadMount(kit, resolve)),
  );

  for (const [at, kit] of kits.entries()) {
    const mountHandler = mounts[at];
    if (!mountHandler) {
      continue;
    }

    const added = cli.commands.length;
    mountHandler({
      cli,
      config: kit.config,
      resolve,
      ...registryFor(kit.name),
    });
    for (const { name } of cli.commands.slice(added)) {
      const taken = owner.get(name);
      if (taken !== undefined) {
        const message = `The "${name}" command is registered by multiple kits: ${kit.name}, ${taken}`;
        throw new Error(message);
      }

      owner.set(name, kit.name);
    }
  }
}
