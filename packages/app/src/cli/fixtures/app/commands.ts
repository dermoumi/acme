import type { KitCli } from "../../mount";

// A real kit imports KitCli from "@acme/app/cli"; this one is inside it.
export default function commands({ cli, config }: KitCli): void {
  const { greeting } = config as { greeting: string };

  cli
    .command("greet <name>", "say hello, to prove a kit's commands mount")
    .option("--loud", "shout it")
    .action((name: string, options: { loud?: boolean }) => {
      const line = `${greeting}, ${name}`;
      console.log(options.loud ? line.toUpperCase() : line);
    });
}
