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
// Declaring nothing is a config too, but naming a file says you meant it, so
// only an unnamed missing one answers nothing.
function configFile(file?: string): string | undefined {
  const resolved = path.resolve(file ?? CONFIG_FILE);

  return !existsSync(resolved) && file === undefined ? undefined : resolved;
}

/**
 * Where an app's config is, as a URL.
 *
 * The base a specifier written *inside* that config resolves against, which is
 * the only base that can be right for one: the app wrote it relative to itself.
 * Answers nothing when there is no config to read.
 *
 * @param file - Path to the config. Defaults to `acme.config.ts` here.
 */
export function acmeConfigUrl(file?: string): string | undefined {
  const resolved = configFile(file);

  return resolved === undefined ? undefined : pathToFileURL(resolved).href;
}

export async function loadAcmeConfig(file?: string): Promise<AcmeConfig> {
  const resolved = configFile(file);
  if (resolved === undefined) {
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
