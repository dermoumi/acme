import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AcmeConfig } from "../internal/config";

export const CONFIG_FILE = "acme.config.ts";
const DEFAULT_CONFIG: Readonly<AcmeConfig> = Object.freeze({});

/**
 * Reads an app's config from a file. Shared by every kit's CLI.
 *
 * Declaring nothing is a config too, so an absent `acme.config.ts` answers an
 * empty one. A file named explicitly must exist: naming it says you meant it.
 *
 * @param file - Path to the config. Defaults to `acme.config.ts` here.
 */
export async function loadAcmeConfig(file?: string): Promise<AcmeConfig> {
  const resolved = path.resolve(file ?? CONFIG_FILE);
  if (!existsSync(resolved) && file === undefined) {
    return DEFAULT_CONFIG;
  }

  const configFilePath = pathToFileURL(resolved).href;
  const loaded = (await import(configFilePath).catch((cause: unknown) => {
    throw new Error(`could not read ${resolved}`, { cause });
  })) as { default?: AcmeConfig };

  if (!loaded.default) {
    throw new Error(`${resolved} must export a config as its default`);
  }

  return loaded.default;
}
