import indexHtml from "../../../test/fixtures/assets/index.html?raw";
import type { GateBindings } from "../gate";
import type { CreateBindings } from "./contract";

// workerd hands back binding responses with immutable headers; reproduce that
// here so the node run holds the worker to the same contract.
function reject(): never {
  throw new TypeError("Can't modify immutable headers.");
}

function seal(res: Response): Response {
  Object.defineProperties(res.headers, {
    set: { value: reject },
    append: { value: reject },
    delete: { value: reject },
  });
  return res;
}

// Matches the fixture's not_found_handling: every path serves index.html.
function assets(): GateBindings["ASSETS"] {
  return {
    fetch: () =>
      Promise.resolve(
        seal(
          new Response(indexHtml, {
            headers: { "Content-Type": "text/html" },
          }),
        ),
      ),
  };
}

export const createBindings: CreateBindings = (overrides = {}) => ({
  ASSETS: assets(),
  ...overrides,
});
