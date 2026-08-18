import { mkdirSync, symlinkSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "./acme-deploy";

interface CliContext {
  root: string;
  out: string[];
  err: string[];
}

// orphan is unlinked, so one prune reports all three counts.
const sandbox = () => {
  beforeEach<CliContext>(async (ctx) => {
    const root = await mkdtemp(path.join(tmpdir(), "acme-deploy-"));
    const nodeModules = path.join(root, "node_modules");
    const store = path.join(nodeModules, ".pnpm");
    mkdirSync(store, { recursive: true });

    for (const dir of ["kept@1.0.0", "dropped@1.0.0", "orphan@1.0.0"]) {
      const name = dir.split("@")[0] ?? "";
      const at = path.join(store, dir, "node_modules", name);
      mkdirSync(at, { recursive: true });
      if (name !== "orphan") symlinkSync(at, path.join(nodeModules, name));
    }

    ctx.root = root;
    ctx.out = [];
    ctx.err = [];
    for (const channel of ["log", "info"] as const) {
      vi.spyOn(console, channel).mockImplementation((...args: unknown[]) => {
        ctx.out.push(args.join(" "));
      });
    }
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      ctx.err.push(args.join(" "));
    });
  });

  afterEach<CliContext>(async ({ root }) => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });
};

describe("run", () => {
  sandbox();

  it<CliContext>("prunes the tree --root names", async ({ root, out }) => {
    expect(await run(["prune", "--root", root, "dropped"])).toBe(0);
    expect(out).toContain("pruned 1 named, 1 stranded, 1 left");
  });

  it<CliContext>("says what went wrong and answers 1", async ({
    root,
    err,
  }) => {
    expect(await run(["prune", "--root", root, "missing"])).toBe(1);
    expect(err.join("\n")).toContain('nothing in the store matches "missing"');
  });

  it<CliContext>("lists prune in help", async ({ out }) => {
    expect(await run(["--help"])).toBe(0);
    expect(out.join("\n")).toContain("prune");
  });

  it<CliContext>("prints usage and answers 1 with no command", async ({
    out,
  }) => {
    expect(await run([])).toBe(1);
    expect(out.join("\n")).toContain("Usage");
  });
});
