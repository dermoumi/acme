import type { Kit } from "../config";

// The URL is literal and lives here, so it resolves against this directory.
export const acmeCommands: Kit = {
  name: "acme",
  cli: new URL("./commands.ts", import.meta.url).href,
};
