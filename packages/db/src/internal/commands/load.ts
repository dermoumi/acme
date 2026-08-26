import type { KitCli } from "@acme/app/cli";
import type { DatabaseConfig, Seed } from "../kit";
import type { Migrations } from "../migrator";

export type Resolve = KitCli["resolve"];

async function importDefault<Value>(
  specifier: string,
  what: string,
): Promise<Value> {
  const loaded = (await import(specifier).catch((cause: unknown) => {
    throw new Error(`${what} cannot be loaded`, { cause });
  })) as { default?: Value };

  if (loaded.default === undefined) {
    throw new Error(`${what} must export it as default`);
  }

  return loaded.default;
}

// Declaring none answers an empty record, so a caller reads one shape.
export async function loadMigrations(
  entry: DatabaseConfig,
  resolve: Resolve,
): Promise<Migrations> {
  if (entry.migrations === undefined) {
    return {};
  }

  return importDefault<Migrations>(
    resolve(entry.migrations),
    `${entry.binding}'s migrations module`,
  );
}

export async function loadSeed(
  entry: DatabaseConfig,
  resolve: Resolve,
): Promise<Seed | undefined> {
  if (entry.seed === undefined) {
    return undefined;
  }

  return importDefault<Seed>(
    resolve(entry.seed),
    `${entry.binding}'s seed module`,
  );
}
