import type { Kit } from "@acme/app";
import type { DatabaseConfig } from "./database";

export const KIT_NAME = "database";

function checkDuplicates(bindings: DatabaseConfig[]): DatabaseConfig[] {
  // Every reader, not just those that go on to pick one: a duplicate would
  // otherwise resolve silently to whichever came first.
  const names = bindings.map((entry) => entry.binding);
  const duplicate = names.find((name, at) => names.indexOf(name) !== at);
  if (duplicate) {
    throw new Error(`the ${KIT_NAME} kit declares ${duplicate} twice`);
  }

  return bindings;
}

/**
 * The database kit, taking every database the app has at once.
 *
 * An app declares it once, however many databases it holds, because a command
 * such as `migrate` acts on all of them unless `--db` names one.
 *
 * @param bindings - The app's databases, in the order they migrate.
 * @throws If two of them claim the same binding.
 */
export function database(bindings: DatabaseConfig[]): Kit {
  return {
    name: KIT_NAME,
    config: checkDuplicates(bindings),
    // The literal URL, never a helper: `import.meta.url` is lexically bound, so
    // one living in @acme/app would resolve against @acme/app's own directory.
    cli: new URL("../cli/commands.ts", import.meta.url).href,
  };
}
