import { fileURLToPath } from "node:url";
import type { Dialect } from "kysely";

const MISSING_MODULE = new Set(["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"]);

// A url may carry a password, and these throws reach Sentry through the app's
// error handler and CI logs through the CLI. Only the scheme is safe to name.
function startOf(url: string): string {
  const protocol = URL.parse(url)?.protocol;

  return protocol ? `${protocol}...` : "<none>";
}

/**
 * Turns a sqlite url into a path `better-sqlite3` accepts.
 *
 * Takes both the WHATWG form (`file:///abs/path.db`) and the relaxed one
 * (`file:relative.db`), which `new URL()` would wrongly resolve to an absolute
 * path. `:memory:` is answered explicitly, in either spelling.
 */
export function toDatabasePath(url: string): string {
  if (url === ":memory:") return ":memory:";
  if (url.startsWith("file://")) return fileURLToPath(url);
  if (url.startsWith("file:")) return url.slice("file:".length);
  throw new Error(`not a sqlite url: "${startOf(url)}"`);
}

/**
 * Awaits an import, naming the package when it turns out not to be installed.
 *
 * Drivers are optional peers, so a missing one is a wiring mistake worth naming
 * rather than a bare ERR_MODULE_NOT_FOUND from deep inside the package. The
 * specifier at the call site must stay a literal: a variable one is opaque to
 * TypeScript, which types the module `any`, and to the bundler.
 */
export async function explainIfMissing<Module>(
  name: string,
  imported: Promise<Module>,
): Promise<Module> {
  try {
    return await imported;
  } catch (cause) {
    const { code } = cause as { code?: string };
    if (!code || !MISSING_MODULE.has(code)) {
      throw cause;
    }

    throw new Error(
      `@acme/db needs the "${name}" package to open this database; add it to your app's dependencies`,
      { cause },
    );
  }
}

async function sqliteDialect(path: string): Promise<Dialect> {
  const [{ default: SQLite }, { SqliteDialect }] = await Promise.all([
    explainIfMissing("better-sqlite3", import("better-sqlite3")),
    import("kysely"),
  ]);
  return new SqliteDialect({ database: new SQLite(path) });
}

async function postgresDialect(url: string): Promise<Dialect> {
  const [{ default: pg }, { PostgresDialect }] = await Promise.all([
    explainIfMissing("pg", import("pg")),
    import("kysely"),
  ]);
  return new PostgresDialect({ pool: new pg.Pool({ connectionString: url }) });
}

/**
 * Builds the dialect a database url asks for.
 *
 * `:memory:` and `file:` open sqlite through `better-sqlite3`; `postgres:` and
 * `postgresql:` open a `pg` pool, which connects lazily. Both drivers are
 * optional peers, imported only on the branch that needs them.
 */
export async function dialectFromUrl(url: string): Promise<Dialect> {
  if (url === ":memory:" || url.startsWith("file:")) {
    return sqliteDialect(toDatabasePath(url));
  }
  if (url.startsWith("postgres:") || url.startsWith("postgresql:")) {
    return postgresDialect(url);
  }
  throw new Error(
    `unsupported database url: "${startOf(url)}". Expected ":memory:", "file:...", or "postgres:..."`,
  );
}
