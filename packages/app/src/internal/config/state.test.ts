import { describe, expect, it, vi } from "vitest";
import type { Kit, KitState } from "./kit";
import { getKitState } from "./state";

// A real kit augments "@acme/app"; this one is inside it, so it names the
// declaring module by path.
declare module "../shared" {
  interface KitShared {
    hush: () => string;
  }
}

const countingKit = (): Kit => {
  return {
    name: "@fixture/counting",
    init: vi.fn((): KitState => ({ vars: () => ({}) })),
  };
};

const hushingKit = (): Kit => {
  return {
    name: "@fixture/hushing",
    init: ({ register }) => {
      register("hush", () => "hushed");

      return {};
    },
  };
};

const listeningKit = (heard: string[]): Kit => {
  return {
    name: "@fixture/listening",
    init: ({ require }) => {
      heard.push(require("hush")());

      return {};
    },
  };
};

// One store for the module, which is one app: these cases share it, so the one
// asking for what nothing registered has to run before the one registering it.
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

  it("names the kit asking for what nothing registers", () => {
    const asking = () => getKitState(listeningKit([]));

    expect(asking).toThrow(
      '@fixture/listening requires "hush", which no declared kit registers',
    );
  });

  it("hands a kit what a kit declared ahead of it registered", () => {
    const heard: string[] = [];

    getKitState(hushingKit());
    getKitState(listeningKit(heard));

    expect(heard).toEqual(["hushed"]);
  });

  it("names both kits when two of them register one key", () => {
    const other: Kit = {
      name: "@fixture/other",
      init: ({ register }) => {
        register("hush", () => "quiet");

        return {};
      },
    };

    expect(() => getKitState(other)).toThrow(
      'The "hush" value is registered by multiple kits: @fixture/other, @fixture/hushing',
    );
  });
});
