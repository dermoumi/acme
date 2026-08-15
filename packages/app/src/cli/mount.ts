import type { CAC } from "cac";
import type { Kit } from "../config";
import { type KitRegistry, kitRegistry } from "./registry";

/**
 * The part of the `acme` CLI a kit is handed: enough to declare its own
 * commands, and nothing that would let it rename the program or its help.
 */
export type KitCommands = Pick<CAC, "command">;

/** What a kit's `cli` module is handed when the CLI mounts it. */
export interface KitCli extends KitRegistry {
  cli: KitCommands;
  /** The kit's own config, as the app declared it. */
  config: unknown;
}

/**
 * What a kit's `cli` module default-exports.
 *
 * Declaring commands is synchronous; an action that needs to reach a database
 * or the network does that when it runs, not while the CLI is being built.
 */
export type KitMount = (context: KitCli) => void;

async function loadMount(kit: Kit): Promise<KitMount | undefined> {
  const specifier = kit.cli;
  if (specifier === undefined) {
    return undefined;
  }

  const loaded = (await import(specifier).catch((cause: unknown) => {
    throw new Error(`${kit.name} names a cli module it cannot load`, { cause });
  })) as { default?: KitMount };

  if (!loaded.default) {
    throw new Error(
      `${kit.name}'s cli module must export its mount as default`,
    );
  }

  return loaded.default;
}

/**
 * Mounts every kit's commands onto the CLI, in the order the app declared.
 *
 * @param cli - The CLI being built, with its own commands already on it.
 * @param kits - The app's kits. Those without a `cli` module contribute none.
 * @throws If a kit's module cannot be loaded, if two kits declare the same
 *   command, which would otherwise resolve silently to whichever came first,
 *   or if two register the same shared key.
 */
export async function mountCommands(cli: CAC, kits: Kit[]): Promise<void> {
  const owner = new Map(cli.commands.map((cmd) => [cmd.name, cli.name]));
  const registryFor = kitRegistry();
  // Loaded up front so one slow import does not hold up the rest, then
  // mounted in order, because that order is what the app declared.
  const mounts = await Promise.all(kits.map(async (kit) => loadMount(kit)));

  for (const [at, kit] of kits.entries()) {
    const mountHandler = mounts[at];
    if (!mountHandler) {
      continue;
    }

    const added = cli.commands.length;
    mountHandler({ cli, config: kit.config, ...registryFor(kit.name) });
    for (const { name } of cli.commands.slice(added)) {
      const taken = owner.get(name);
      if (taken !== undefined) {
        throw new Error(`${kit.name} and ${taken} both declare "${name}"`);
      }

      owner.set(name, kit.name);
    }
  }
}
