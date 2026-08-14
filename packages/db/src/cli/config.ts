import { loadAcmeConfig } from "@acme/app/cli";
import { type AnyDatabaseConfig, databasesOf } from "../kit";

/**
 * The databases an app declared through the database kit.
 *
 * @param file - Path to the config. Defaults to the one in the working
 *   directory, whose absence means an app that declares nothing.
 */
export async function loadDatabases(
  file?: string,
): Promise<AnyDatabaseConfig[]> {
  return databasesOf(await loadAcmeConfig(file));
}

/**
 * Finds one declared database by its binding, for a caller that is not a
 * command and so was handed no config.
 *
 * @param binding - The binding the app declared it under.
 * @param file - Path to the config. Defaults to the working directory's.
 * @throws If the app declares no database bound to that name.
 */
export async function databaseNamed(
  binding: string,
  file?: string,
): Promise<AnyDatabaseConfig> {
  const declared = await loadDatabases(file);
  const one = declared.find((entry) => entry.binding === binding);
  if (!one) {
    const known = declared.map((entry) => entry.binding).join(", ");
    throw new Error(
      `no database bound to ${binding}${known ? `: ${known}` : ""}`,
    );
  }

  return one;
}
