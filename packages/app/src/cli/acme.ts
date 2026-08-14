import { readFileSync } from "node:fs";
import path from "node:path";
import { type CAC, cac } from "cac";
import { pruneDeployTree } from "./prune";

const { version } = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "../../package.json"), "utf8"),
) as { version: string };

function buildCli(): CAC {
  const cli = cac("acme");

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
  return cli;
}

// Errors are wrapped to say which step failed, so the message alone hides the
// syntax error or missing module that actually explains it.
function messageWithCauses(error: unknown): string {
  const chain: string[] = [];
  for (let at = error; at instanceof Error; at = at.cause) {
    chain.push(at.message);
  }

  return chain.join("\n  caused by: ");
}

/**
 * Runs one command and answers the exit code, without touching the process.
 *
 * @param argv - Arguments after the command name, as `process.argv.slice(2)`.
 */
export async function run(argv: string[]): Promise<number> {
  const cli = buildCli();
  try {
    // Parsing prints help or the version itself; running is ours to do, so the
    // action's promise is awaited rather than left dangling.
    cli.parse(["node", "acme", ...argv], { run: false });
    if (cli.options.help || cli.options.version) {
      return 0;
    }

    if (!cli.matchedCommand) {
      cli.outputHelp();
      return 1;
    }

    await cli.runMatchedCommand();
  } catch (error) {
    console.error(error instanceof Error ? messageWithCauses(error) : error);
    return 1;
  }

  return 0;
}
