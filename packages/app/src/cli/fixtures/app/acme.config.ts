import { defineConfig, type Kit } from "../../../config";

// What a real kit looks like: a function taking the app's options and
// answering a kit whose commands close over them.
const greeter = (greeting: string): Kit => ({
  name: "greeter",
  commands: (cli) => {
    cli
      .command("greet <name>", "say hello, to prove a kit's commands mount")
      .option("--loud", "shout it")
      .action((name: string, options: { loud?: boolean }) => {
        const line = `${greeting}, ${name}`;
        console.log(options.loud ? line.toUpperCase() : line);
      });
  },
});

const config = defineConfig({ kits: [greeter("hello")] });

export default config;
