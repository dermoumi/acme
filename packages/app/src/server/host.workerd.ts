import type { Host } from "./contract";

export const host: Host = {
  // Exporting it is all a Worker does; it never leaves, so shutdown never runs.
  serve: (handler) => {
    return handler;
  },
};
