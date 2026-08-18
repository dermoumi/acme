import type { AcmeConfig } from "@acme/app";
import { kitOf } from "./get-test-db";

/**
 * Closes every database the config declares and forgets them.
 *
 * ```ts
 * beforeEach(() => resetDb(config));
 * ```
 *
 * An accessor holds its connection for the life of the process, so a suite
 * wanting a private database per case resets between them. Import it only from
 * tests: production code has no reason to drop a live connection.
 *
 * @throws If the config declares no database kit.
 */
export async function resetDb(config: AcmeConfig): Promise<void> {
  const held = [...kitOf(config).accessors.values()];

  await Promise.all(
    held.map((accessor) => {
      return accessor.clear();
    }),
  );
}
