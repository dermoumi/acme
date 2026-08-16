import { mkdirSync, readdirSync, symlinkSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pruneDeployTree } from "./prune";

interface PruneContext {
  root: string;
  store: string;
}

/** Creates a store entry, the way pnpm lays one out, and answers its directory. */
function entry(store: string, dir: string, name: string): string {
  const at = path.join(store, dir, "node_modules", name);
  mkdirSync(at, { recursive: true });

  return at;
}

function link(nodeModules: string, name: string, target: string): void {
  const at = path.join(nodeModules, name);
  mkdirSync(path.dirname(at), { recursive: true });
  symlinkSync(target, at);
}

function remaining(store: string): string[] {
  return readdirSync(store).toSorted();
}

// A tree whose shape is the point: `deep` is reachable only through `kept`,
// and `orphan` is in the store with nothing linking it.
const sandbox = () => {
  beforeEach<PruneContext>(async (ctx) => {
    const root = await mkdtemp(path.join(tmpdir(), "acme-prune-"));
    const nodeModules = path.join(root, "node_modules");
    const store = path.join(nodeModules, ".pnpm");
    mkdirSync(store, { recursive: true });

    const kept = entry(store, "kept@1.0.0", "kept");
    const deep = entry(store, "deep@1.0.0", "deep");
    const dropped = entry(store, "dropped@1.0.0", "dropped");
    const scoped = entry(store, "@scope+tool@1.0.0", "@scope/tool");
    const x64 = entry(store, "plat-x64@1.0.0", "plat-x64");
    const arm = entry(store, "plat-arm@1.0.0", "plat-arm");
    entry(store, "orphan@1.0.0", "orphan");

    link(nodeModules, "kept", kept);
    link(nodeModules, "dropped", dropped);
    link(nodeModules, "@scope/tool", scoped);
    link(nodeModules, "plat-x64", x64);
    link(nodeModules, "plat-arm", arm);
    link(path.join(store, "kept@1.0.0", "node_modules"), "deep", deep);

    ctx.root = root;
    ctx.store = store;
  });

  afterEach<PruneContext>(async ({ root }) => {
    await rm(root, { recursive: true, force: true });
  });
};

describe("pruneDeployTree", () => {
  sandbox();

  it<PruneContext>("drops a named package", ({ root, store }) => {
    pruneDeployTree(["dropped"], root);

    expect(remaining(store)).not.toContain("dropped@1.0.0");
  });

  it<PruneContext>("keeps what the tree still links", ({ root, store }) => {
    pruneDeployTree(["dropped"], root);

    expect(remaining(store)).toContain("kept@1.0.0");
  });

  it<PruneContext>("drops what nothing reaches any more", ({ root, store }) => {
    pruneDeployTree(["kept"], root);

    // deep was reachable only through kept.
    expect(remaining(store)).not.toContain("deep@1.0.0");
  });

  it<PruneContext>("drops what nothing reached to begin with", ({
    root,
    store,
  }) => {
    pruneDeployTree(["dropped"], root);

    expect(remaining(store)).not.toContain("orphan@1.0.0");
  });

  it<PruneContext>("counts what it named, stranded and left", ({ root }) => {
    // orphan is the only stranded one; kept, deep, @scope+tool and both
    // platform builds stay live.
    expect(pruneDeployTree(["dropped"], root)).toEqual({
      named: 1,
      stranded: 1,
      live: 5,
    });
  });

  it<PruneContext>("prunes the working directory by default", ({
    root,
    store,
  }) => {
    const before = process.cwd();
    try {
      process.chdir(root);
      pruneDeployTree(["dropped"]);
    } finally {
      process.chdir(before);
    }

    expect(remaining(store)).not.toContain("dropped@1.0.0");
  });

  it<PruneContext>("covers every build behind one prefix", ({
    root,
    store,
  }) => {
    pruneDeployTree(["plat-*"], root);

    expect(remaining(store)).not.toContain("plat-x64@1.0.0");
    expect(remaining(store)).not.toContain("plat-arm@1.0.0");
  });

  it<PruneContext>("matches a scoped name pnpm has encoded", ({
    root,
    store,
  }) => {
    pruneDeployTree(["@scope/tool"], root);

    expect(remaining(store)).not.toContain("@scope+tool@1.0.0");
  });

  it<PruneContext>("leaves a partial name alone", ({ root, store }) => {
    // "plat" without a `*` is not "plat-x64": the version follows the name.
    expect(() => pruneDeployTree(["plat"], root)).toThrow(/matches "plat"/u);
    expect(remaining(store)).toContain("plat-x64@1.0.0");
  });

  it<PruneContext>("refuses a name that matches nothing", ({ root }) => {
    expect(() => pruneDeployTree(["missing"], root)).toThrow(
      /nothing in the store matches "missing"/u,
    );
  });

  it<PruneContext>("refuses to prune nothing", ({ root }) => {
    expect(() => pruneDeployTree([], root)).toThrow(/at least one package/u);
  });

  it("refuses a tree with no store", async () => {
    const bare = await mkdtemp(path.join(tmpdir(), "acme-prune-bare-"));
    try {
      expect(() => pruneDeployTree(["anything"], bare)).toThrow(
        /no pnpm store to prune/u,
      );
    } finally {
      await rm(bare, { recursive: true, force: true });
    }
  });
});
