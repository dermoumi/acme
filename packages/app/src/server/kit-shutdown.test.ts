import { defineConfig, type Kit } from "@acme/app";
import { describe, expect, it } from "vitest";
import { shutdownKits } from "./kit-shutdown";

const closingKit = (name: string, closed: string[]): Kit => {
  return {
    name: `@fixture/${name}`,
    init: () => ({
      shutdown: async () => {
        await Promise.resolve();
        closed.push(name);
      },
    }),
  };
};

describe("shutdownKits", () => {
  it("runs every declared kit's shutdown", async () => {
    const closed: string[] = [];
    const config = defineConfig({
      kits: [closingKit("first", closed), closingKit("second", closed)],
    });

    await shutdownKits(config);

    expect(closed.toSorted()).toEqual(["first", "second"]);
  });

  // The host leaves as soon as this answers, so an unfinished hook is lost.
  it("answers only once every hook has finished", async () => {
    const closed: string[] = [];
    const config = defineConfig({ kits: [closingKit("slow", closed)] });

    const pending = shutdownKits(config);
    expect(closed).toEqual([]);
    await pending;

    expect(closed).toEqual(["slow"]);
  });

  it("leaves a kit shutting nothing down alone", async () => {
    const config = defineConfig({ kits: [{ name: "@fixture/quiet" }] });

    await expect(shutdownKits(config)).resolves.toBeUndefined();
  });

  it("takes the app's own config when none is passed", async () => {
    await expect(shutdownKits()).resolves.toBeUndefined();
  });
});
