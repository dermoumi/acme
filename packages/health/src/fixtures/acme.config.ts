import { defineConfig, type Kit } from "@acme/app";
import { healthKit } from "../kit";

// After the health kit, which is what lets it require what that kit registered.
const contributor: Kit = {
  name: "@fixture/contributor",
  init: ({ require }) => {
    const addHealthStatus = require("addHealthStatus");
    addHealthStatus("verdict", () => "up");
    addHealthStatus("detail", () => "why", { optional: true });
    addHealthStatus("thrower", () => {
      throw new Error("this contributor is broken");
    });

    return {};
  },
};

export default defineConfig({ kits: [healthKit(), contributor] });
