import { describe, expect, it } from "vitest";
import { urlVarFor } from "./url-var";

describe("urlVarFor", () => {
  it("appends _URL to the binding", () => {
    expect(urlVarFor("DATABASE")).toBe("DATABASE_URL");
  });

  // Deliberately no case change: a deploy exports the name it built from the
  // binding it read, so transforming here would miss what it exported.
  it("leaves the binding's case alone", () => {
    expect(urlVarFor("analytics")).toBe("analytics_URL");
    expect(urlVarFor("MixedCase")).toBe("MixedCase_URL");
  });

  it("takes an explicit name over the derived one", () => {
    expect(urlVarFor("DATABASE", "SOMETHING_ELSE")).toBe("SOMETHING_ELSE");
  });
});
