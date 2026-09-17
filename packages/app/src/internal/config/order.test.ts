import { describe, expect, it } from "vitest";
import appConfig from "../../cli/fixtures/app/acme.config";
import type { Kit } from "./kit";
import { checkKitRequires, orderKits } from "./order";

const kit = (name: string, requires?: string[]): Kit => {
  return { name, requires };
};

const getNames = (kits: Kit[]) => {
  return kits.map((one) => one.name);
};

describe("orderKits", () => {
  it("keeps the declared order when no kit requires another", () => {
    const kits = [kit("@fixture/a"), kit("@fixture/b"), kit("@fixture/c")];

    expect(orderKits(kits)).toEqual(kits);
  });

  it("answers the declared kits themselves", () => {
    const only = kit("@fixture/a");

    expect(orderKits([only])[0]).toBe(only);
  });

  it("sorts a kit behind what it requires", () => {
    const kits = [kit("@fixture/a", ["@fixture/b"]), kit("@fixture/b")];

    expect(getNames(orderKits(kits))).toEqual(["@fixture/b", "@fixture/a"]);
  });

  // The case the feature exists for: what everything needs is listed last.
  it("keeps the order of kits requiring the same one", () => {
    const kits = [
      kit("@fixture/db", ["@fixture/health"]),
      kit("@fixture/sentry", ["@fixture/health"]),
      kit("@fixture/health"),
    ];

    expect(getNames(orderKits(kits))).toEqual([
      "@fixture/health",
      "@fixture/db",
      "@fixture/sentry",
    ]);
  });

  it("moves nothing for a requirement the app never declared", () => {
    const kits = [kit("@fixture/a", ["@fixture/absent"]), kit("@fixture/b")];

    expect(getNames(orderKits(kits))).toEqual(["@fixture/a", "@fixture/b"]);
  });

  it("takes an app declaring no kits at all", () => {
    expect(orderKits([])).toEqual([]);
  });

  it("names the two kits requiring one another", () => {
    const kits = [
      kit("@fixture/a", ["@fixture/b"]),
      kit("@fixture/b", ["@fixture/a"]),
    ];

    expect(() => orderKits(kits)).toThrow(
      "Kits require one another in a cycle: @fixture/a -> @fixture/b -> @fixture/a",
    );
  });

  // The kit merely waiting on the cycle is not part of it.
  it("names only the kits the cycle runs through", () => {
    const kits = [
      kit("@fixture/waiting", ["@fixture/b"]),
      kit("@fixture/b", ["@fixture/c"]),
      kit("@fixture/c", ["@fixture/b"]),
    ];

    expect(() => orderKits(kits)).toThrow(
      "Kits require one another in a cycle: @fixture/b -> @fixture/c -> @fixture/b",
    );
  });

  // Pins the order against the day a kit here starts requiring another.
  it("leaves this package's fixture config as declared", () => {
    expect(orderKits(appConfig.kits ?? [])).toEqual(appConfig.kits);
  });
});

describe("checkKitRequires", () => {
  it("names the kit and what it needed", () => {
    const kits = [kit("@fixture/a", ["@fixture/absent"])];

    const checking = () => {
      checkKitRequires(kits);
    };

    expect(checking).toThrow(
      "@fixture/a requires @fixture/absent, which this app does not declare",
    );
  });

  it("takes an app declaring what its kits require", () => {
    const kits = [kit("@fixture/a", ["@fixture/b"]), kit("@fixture/b")];

    const checking = () => {
      checkKitRequires(kits);
    };

    expect(checking).not.toThrow();
  });
});
