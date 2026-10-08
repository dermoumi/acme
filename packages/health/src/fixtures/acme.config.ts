import { defineConfig, type Kit } from "@acme/app";
import { healthKit } from "../kit";

// Ahead of the health kit it requires: the sort is what puts these in order.
const contributor: Kit = {
  name: "@fixture/contributor",
  requires: ["@acme/health"],
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

export default defineConfig({ kits: [contributor, healthKit()] });
