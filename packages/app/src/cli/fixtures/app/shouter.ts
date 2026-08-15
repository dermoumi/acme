import type { KitCli } from "../../mount";

// Reads at action time, never at mount, which is what lets an app list this
// kit before the one that registers what it needs.
export default function shouter({ cli, require }: KitCli): void {
  cli
    .command("shout <name>", "prove a kit reaches what another registered")
    .action((name: string) => {
      console.log(`${require<string>("greeting").toUpperCase()}, ${name}`);
    });
}
