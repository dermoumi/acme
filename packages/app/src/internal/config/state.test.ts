import { describe, expect, it, vi } from "vitest";
import type { Kit, KitState } from "./kit";
import { getKitState } from "./state";

const countingKit = (): Kit => {
  return {
    name: "@fixture/counting",
    init: vi.fn((): KitState => ({ vars: () => ({}) })),
  };
};

describe("getKitState", () => {
  it("builds a kit once, however often it is asked", () => {
    const kit = countingKit();

    getKitState(kit);
    getKitState(kit);

    expect(kit.init).toHaveBeenCalledOnce();
  });

  it("answers what that one build produced", () => {
    const kit = countingKit();

    expect(getKitState(kit)).toBe(getKitState(kit));
  });

  // Two calls to a kit's factory are two declarations, and an app means both.
  it("builds each declared kit on its own", () => {
    const one = countingKit();
    const other = countingKit();

    expect(getKitState(one)).not.toBe(getKitState(other));
  });

  it("answers a state for a kit that builds nothing", () => {
    expect(getKitState({ name: "@fixture/quiet" })).toEqual({});
  });
});
