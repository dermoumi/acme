import type { KitVite } from "@acme/app/vite";
import { reactRouter } from "@react-router/dev/vite";
import type { Plugin } from "vite";

const serverEntry: Plugin = {
  name: "@acme/router/server-entry",
  config: () => {
    return {
      environments: {
        ssr: {
          build: {
            rolldownOptions: {
              input: "src/server/index.ts",
              // One file, which a node host can run without a package.json.
              output: { codeSplitting: false },
            },
          },
        },
      },
    };
  },
};

const kitVite: KitVite = () => {
  // The router's plugin refuses vitest, which runs it without a config file.
  return process.env.VITEST ? [] : [serverEntry, reactRouter()];
};

export default kitVite;
