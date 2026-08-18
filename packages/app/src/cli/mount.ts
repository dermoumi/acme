import type { CAC } from "cac";
import type { Kit } from "../internal/config";
import { type KitRegistry, kitRegistry } from "./registry";

/**
 * The part of the `acme` CLI a kit is handed: enough to declare its own
 * commands, and nothing that would let it rename the program or its help.
 */
export type KitCommands = Pick<CAC, "command">;

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
export type KitCliMount = (context: KitCli) => void;

async function loadMount(kit: Kit): Promise<KitCliMount | undefined> {
  if (kit.commands === undefined) {
    return undefined;
  }

  const specifier = kit.commands();

  const importSpecifier = async () => {
    try {
      return (await import(specifier)) as { default?: KitCliMount };
    } catch (cause: unknown) {
      const message = `Commands module from ${kit.name} cannot be loaded.`;
      throw new Error(message, { cause });
    }
  };

  const { default: cliMount } = await importSpecifier();
  if (!cliMount) {
    const message = `${kit.name}'s commands module must export its mount as default`;
    throw new Error(message);
  }

  return cliMount;
}

function resolverFor(configUrl: string | undefined) {
  return (specifier: string): string => {
    if (configUrl === undefined) {
      const message = `cannot resolve "${specifier}": no config file was read`;
      throw new Error(message);
    }

    return new URL(specifier, configUrl).href;
  };
}

/**
 * Mounts every kit's commands onto the CLI, in the order the app declared.
 *
 * @param cli - The CLI being built, with its own commands already on it.
 * @param kits - The app's kits. Those declaring no `commands` add nothing.
 * @param configUrl - Where the app's config was read from, which specifiers
 *   inside it resolve against. Absent when the caller passed a config in hand.
 * @throws If a kit's module cannot be loaded, or if two kits register the same
 *   command or shared key, either of which would otherwise resolve silently to
 *   whichever came first.
 */
export async function mountCommands(
  cli: CAC,
  kits: Kit[],
  configUrl?: string,
): Promise<void> {
  const owner = new Map(cli.commands.map((cmd) => [cmd.name, cli.name]));
  const registryFor = kitRegistry();
  const resolve = resolverFor(configUrl);
  // Loaded up front so one slow import does not hold up the rest, then
  // mounted in order, because that order is what the app declared.
  const mounts = await Promise.all(kits.map(async (kit) => loadMount(kit)));

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
