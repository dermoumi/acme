import type { Host } from "./contract";

export const host: Host = {
  // Exporting it is all a Worker does; the platform calls it.
  serve: (handler) => {
    return handler;
  },
};
