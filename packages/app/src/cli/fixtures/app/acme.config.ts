import { defineConfig, type Kit } from "../../../internal/config";

// A real kit: a function taking options, pointing at its own commands.
const greeter = (greeting: string): Kit => ({
  name: "@fixture/greeter",
  config: { greeting },
  commands: "./commands.ts",
});

// Declares no config of its own: all it needs is where this file is.
const resolver: Kit = {
  name: "@fixture/resolver",
  commands: "./resolver.ts",
};

const config = defineConfig({ kits: [greeter("hello"), resolver] });

export default config;
