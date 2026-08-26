import { fileURLToPath } from "node:url";
import type { Dialect } from "kysely";
import { tagDialect } from "../dialect";

const MISSING_MODULE = new Set(["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"]);

// A url may carry a password, and these throws reach Sentry through the app's
// error handler and CI logs through the CLI. Only the scheme is safe to name.
function startOf(url: string): string {
  const protocol = URL.parse(url)?.protocol;

  return protocol ? `${protocol}...` : "<none>";
}

// Takes the relaxed `file:relative.db` form too, which new URL() would resolve
// to the wrong absolute path. `:memory:` is answered in either spelling.
export function toDatabasePath(url: string): string {
  if (url === ":memory:") return ":memory:";
  if (url.startsWith("file://")) return fileURLToPath(url);
  if (url.startsWith("file:")) return url.slice("file:".length);
  throw new Error(`not a sqlite url: "${startOf(url)}"`);
}

// The specifier at the call site must stay a literal: a variable one is opaque
// to TypeScript, which types the module `any`, and to the bundler.
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

    const message = `@acme/db needs the "${name}" package to open this database; add it to your app's dependencies`;
    throw new Error(message, { cause });
  }
}

async function sqliteDialect(path: string): Promise<Dialect> {
  const [{ default: SQLite }, { SqliteDialect }] = await Promise.all([
    explainIfMissing("better-sqlite3", import("better-sqlite3")),
    import("kysely"),
  ]);
  return tagDialect(
    new SqliteDialect({ database: new SQLite(path) }),
    "sqlite",
  );
}

async function postgresDialect(url: string): Promise<Dialect> {
  const [{ default: pg }, { PostgresDialect }] = await Promise.all([
    explainIfMissing("pg", import("pg")),
    import("kysely"),
  ]);
  return tagDialect(
    new PostgresDialect({ pool: new pg.Pool({ connectionString: url }) }),
    "postgres",
  );
}

// Both drivers are optional peers, imported only on the branch that needs them.
export async function dialectFromUrl(url: string): Promise<Dialect> {
  if (url === ":memory:" || url.startsWith("file:")) {
    return sqliteDialect(toDatabasePath(url));
  }
  if (url.startsWith("postgres:") || url.startsWith("postgresql:")) {
    return postgresDialect(url);
  }
  const message = `unsupported database url: "${startOf(url)}". Expected ":memory:", "file:...", or "postgres:..."`;
  throw new Error(message);
}
