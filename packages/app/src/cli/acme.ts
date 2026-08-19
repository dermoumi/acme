import { readFileSync } from "node:fs";
import path from "node:path";
import { type CAC, cac } from "cac";
import type { AcmeConfig, Kit } from "../internal/config";
import { acmeConfigUrl, CONFIG_FILE, loadAcmeConfig } from "./config";
import { mountCommands } from "./mount";

const { version } = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "../../package.json"), "utf8"),
) as { version: string };

// Which commands exist depends on the config, and cac matches against the
// commands it already has, so a throwaway CLI reads the flag first.
export function getConfigFile(argv: string[]): string | undefined {
  const probe = cac().option("-c, --config <file>", "the config to read");
  const parsed = probe.parse(["node", "acme", ...argv], { run: false });
  const { config } = parsed.options;

  return typeof config === "string" ? config : undefined;
}

async function buildCli(kits: Kit[], configUrl?: string): Promise<CAC> {
  const cli = cac("acme");
  cli.option("-c, --config <file>", "the config to read", {
    default: CONFIG_FILE,
  });

  await mountCommands(cli, kits, configUrl);
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

function report(error: unknown): number {
  console.error(error instanceof Error ? messageWithCauses(error) : error);
  return 1;
}

/**
 * Runs one command against a config in hand, and answers the exit code.
 *
 * @param config - The app's config. Nothing is read from disk, and `-c` is not
 *   consulted: the caller has already decided what the app declares.
 * @param argv - Arguments after the command name, as `process.argv.slice(2)`.
 * @param configUrl - Where that config lives, for the kits whose specifiers are
 *   written relative to it. Without it those kits fail when they resolve one,
 *   which is the honest answer for a config that came from nowhere.
 */
export async function runWithConfig(
  config: AcmeConfig,
  argv: string[],
  configUrl?: string,
): Promise<number> {
  try {
    const cli = await buildCli(config.kits ?? [], configUrl);
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
    return report(error);
  }

  return 0;
}

/**
 * Runs one command, taking the app's config from its file. The CLI's entry.
 *
 * @param argv - Arguments after the command name, as `process.argv.slice(2)`.
 */
export async function run(argv: string[]): Promise<number> {
  try {
    const file = getConfigFile(argv);
    const config = await loadAcmeConfig(file);
    return await runWithConfig(config, argv, acmeConfigUrl(file));
  } catch (error) {
    return report(error);
  }
}
