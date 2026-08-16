import { defineConfig, type Kit } from "../../../internal/config";

// What a real kit looks like: a function taking the app's options, answering a
// kit that points at its own commands rather than carrying them.
const greeter = (greeting: string): Kit => ({
  name: "greeter",
  config: { greeting },
  cli: new URL("./commands.ts", import.meta.url).href,
});

const config = defineConfig({ kits: [greeter("hello")] });

export default config;
