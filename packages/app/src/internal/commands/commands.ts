import type { KitCli } from "../../cli/mount";
import { pruneDeployTree } from "./prune";

/**
 * The commands `acme` brings itself, mounted the way every kit's are.
 *
 * The default export because that is what `Kit.cli` names, and reached by URL
 * for the same reason a package's would be.
 */
export default function commands({ cli }: KitCli): void {
  cli
    .command(
      "prune <...packages>",
      "drop packages from a deployed tree, then whatever nothing reaches",
    )
    .option("-r, --root <dir>", "the tree to prune", { default: "." })
    .action((packages: string[], options: { root: string }) => {
      const { named, stranded, live } = pruneDeployTree(packages, options.root);
      console.log(`pruned ${named} named, ${stranded} stranded, ${live} left`);
    });
}
