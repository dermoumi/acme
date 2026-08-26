import { describe, expect, it } from "vitest";
import { runtime } from "./index";

// Asked of the engine, not of the seam, which would agree with itself even if
// the condition picked the wrong arm. navigator is undeclared in workers-types.
const { navigator } = globalThis as { navigator?: { userAgent?: string } };
const engine =
  navigator?.userAgent === "Cloudflare-Workers" ? "workerd" : "node";

describe("runtime", () => {
  it("resolves the arm the running engine names", () => {
    expect(runtime.name).toBe(engine);
  });
});
