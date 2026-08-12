import { CACHE, type ClearCache } from "../internal/db/cache";

/**
 * Closes the database an accessor holds and forgets it.
 *
 * An accessor caches for the life of the process, so a suite wanting a private
 * database per case resets between them. Import it only from tests: production
 * code has no reason to drop a live connection.
 */
export async function resetDb(accessor: object): Promise<void> {
  const clear = (accessor as Record<symbol, ClearCache | undefined>)[CACHE];
  if (!clear) {
    throw new Error("resetDb expects an accessor returned by defineDb");
  }

  await clear();
}
