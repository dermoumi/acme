import { defineConfig, type Kit } from "../../../internal/config";

// A real kit: a function taking options, pointing at its own commands.
const greeter = (greeting: string): Kit => ({
  name: "greeter",
  config: { greeting },
  commands: () => new URL("./commands.ts", import.meta.url).href,
});

// Declares no config of its own: all it needs is where this file is.
const resolver: Kit = {
  name: "resolver",
  commands: () => new URL("./resolver.ts", import.meta.url).href,
};

const config = defineConfig({ kits: [greeter("hello"), resolver] });

export default config;
