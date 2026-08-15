import type { KitCli } from "../../mount";

export default function commands({ cli, config, registry }: KitCli): void {
  const { greeting } = config as { greeting: string };
  registry.register("greeting", greeting);

  cli
    .command("greet <name>", "say hello, to prove a kit's commands mount")
    .option("--loud", "shout it")
    .action((name: string, options: { loud?: boolean }) => {
      const line = `${greeting}, ${name}`;
      console.log(options.loud ? line.toUpperCase() : line);
    });
}
