import type { KitContext } from "@acme/app";
import { createKitContext } from "@acme/app/testing";
import type { HealthStatus } from "../kit";

/**
 * The health kit stood in for, and what the kit under test offered it.
 */
export interface HealthStub {
  /**
   * What the kit under test is initialised with.
   */
  context: KitContext;
  /**
   * What that kit offered under one key.
   *
   * @throws If it offered nothing under that key.
   */
  status: (key: string) => HealthStatus;
}

/**
 * Stands in for the health kit, for a test calling a contributor's `init`.
 *
 * @param kit The contributor's specifier, which its errors are named for.
 */
export function stubHealthKit(kit: string): HealthStub {
  const offered = new Map<string, HealthStatus>();
  const context = createKitContext(kit);
  context.register("addHealthStatus", (key, status) => {
    offered.set(key, status);
  });

  return {
    context,
    status: (key) => {
      const found = offered.get(key);
      if (!found) {
        throw new Error(`the kit offered no "${key}" status`);
      }

      return found;
    },
  };
}
