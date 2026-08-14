import { readFileSync } from "node:fs";
import path from "node:path";
import { CONFIG_FILE, getConfigFile } from "@acme/app/cli";
import { type CAC, cac } from "cac";
import type { AnyDatabaseConfig } from "../kit";
import commands from "./commands";
import { loadDatabases } from "./config";

const { version } = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "../../package.json"), "utf8"),
) as { version: string };

// The same commands the `acme` CLI mounts, so the two entries cannot drift.
function buildCli(declared: AnyDatabaseConfig[]): CAC {
  const cli = cac("acme-db");
  cli.option("-c, --config <file>", "the config to read", {
    default: CONFIG_FILE,
  });
  commands({ cli, config: declared });
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
 * The way in when the app layer is what is broken: it reads the same config and
 * mounts the same commands, but never builds the app's CLI.
 *
 * @param argv - Arguments after the command name, as `process.argv.slice(2)`.
 */
export async function run(argv: string[]): Promise<number> {
  try {
    const cli = buildCli(await loadDatabases(getConfigFile(argv)));
    // Parsing prints help or the version itself; running is ours to do, so the
    // action's promise is awaited rather than left dangling.
    cli.parse(["node", "acme-db", ...argv], { run: false });
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
