/// <reference types="@acme/app/types" />

import type { AcmeConfig } from "@acme/app";
import virtualConfig from "virtual:acme-config";
import { kitOf } from "./get-test-db";

/**
 * Closes every database the config declares and forgets them.
 *
 * An accessor holds its connection for the life of the process, so a suite
 * wanting a private database per case resets between them. Import it only from
 * tests: production code has no reason to drop a live connection.
 *
 * @param config Defaults to `virtual:acme-config`.
 * @throws If the config declares no database kit.
 */
export async function resetDb(
  config: AcmeConfig = virtualConfig,
): Promise<void> {
  const held = [...kitOf(config).accessors.values()];

  await Promise.all(
    held.map((accessor) => {
      return accessor.clear();
    }),
  );
}
