import type { KitCli } from "../../mount";

export default function commands({ cli, resolve }: KitCli): void {
  cli
    .command("resolve <specifier>", "print what a specifier resolves to")
    .action((specifier: string) => {
      console.log(resolve(specifier));
    });
}
