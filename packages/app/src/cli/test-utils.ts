import { afterEach, beforeEach, vi } from "vitest";

export interface CliContext {
  out: string[];
  err: string[];
}

// A hook reaches only its own describe, so every block installs the sandbox.
export const sandbox = () => {
  beforeEach<CliContext>((ctx) => {
    ctx.out = [];
    ctx.err = [];
    // cac prints help and the version through console.info, not log.
    for (const channel of ["log", "info"] as const) {
      vi.spyOn(console, channel).mockImplementation((...args: unknown[]) => {
        ctx.out.push(args.join(" "));
      });
    }
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      ctx.err.push(args.join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
};
