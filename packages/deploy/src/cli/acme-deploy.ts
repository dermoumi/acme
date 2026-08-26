import { readFileSync } from "node:fs";
import path from "node:path";
import { cac } from "cac";
import { pruneDeployTree } from "../prune";

const { version } = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "../../package.json"), "utf8"),
) as { version: string };

/**
 * Runs one command, and answers the exit code. The CLI's entry.
 *
 * @param argv Arguments after the command name, as `process.argv.slice(2)`.
 */
export async function run(argv: string[]): Promise<number> {
  const cli = cac("acme-deploy");
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
  cli.help();
  cli.version(version);

  try {
    cli.parse(["node", "acme-deploy", ...argv], { run: false });
    if (cli.options.help || cli.options.version) {
      return 0;
    }

    if (!cli.matchedCommand) {
      cli.outputHelp();
      return 1;
    }

    await cli.runMatchedCommand();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }

  return 0;
}
