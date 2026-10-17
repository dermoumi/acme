import { describe, expect, it } from "vitest";
import { getErrorText } from "./error-text";

describe("getErrorText", () => {
  it("answers a status's own text", () => {
    expect(getErrorText(404).title).toBe("Page not found");
  });

  it("answers the client error default for a 4xx without one", () => {
    expect(getErrorText(418).title).toBe("Request not completed");
  });

  it("answers the server error default for a 5xx", () => {
    expect(getErrorText(503).title).toBe("Something went wrong");
  });
});
