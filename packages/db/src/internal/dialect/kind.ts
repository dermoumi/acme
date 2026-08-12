import type { Dialect, DialectAdapter, Kysely } from "kysely";

/** The SQL a dialect speaks. D1 answers `sqlite`, which is what it runs. */
export type DialectKind = "postgres" | "sqlite";

// Registry symbol, not a module-local one: the node build inlines this package
// into its bundle while the CLI loads it from source, so both must agree.
const KIND = Symbol.for("@acme/db.dialectKind");

interface Tagged {
  [KIND]?: DialectKind;
}

/**
 * Records which SQL a dialect speaks, so a migration can ask later.
 *
 * The tag rides on the adapter because that is the one object Kysely shares
 * with the transaction it wraps a migration in; anything held on the `Kysely`
 * itself is lost by the time `up()` runs.
 *
 * Tags in place and hands the same dialect back, so callers keep whatever they
 * built: a wrapper would answer `instanceof SqliteDialect` with false.
 *
 * @param dialect The dialect to tag, as constructed by its caller.
 * @param kind The SQL it speaks.
 */
export function tagDialect<Source extends Dialect>(
  dialect: Source,
  kind: DialectKind,
): Source {
  const createAdapter = dialect.createAdapter.bind(dialect);
  dialect.createAdapter = () => {
    const adapter: DialectAdapter & Tagged = createAdapter();
    adapter[KIND] = kind;

    return adapter;
  };

  return dialect;
}

/**
 * Answers which SQL a database speaks, from inside a migration or a query.
 *
 * Reads only the tag {@link tagDialect} left on the adapter. Every dialect the
 * kit builds carries one; a dialect built elsewhere must be tagged before it
 * reaches here.
 *
 * Deliberately does not guess from adapter capabilities: they describe what an
 * engine can do, not which SQL it writes, so a future MySQL or MariaDB would
 * silently take another engine's branch and emit DDL that does not fit it.
 *
 * @param db Any database handle, including the one a migration is given.
 * @throws Error when the dialect carries no tag.
 */
export function dialectKind<DB>(db: Kysely<DB>): DialectKind {
  const adapter: DialectAdapter & Tagged = db.getExecutor().adapter;
  const kind = adapter[KIND];
  if (!kind) {
    throw new Error(
      "this database's dialect is untagged, so @acme/db cannot tell which SQL it speaks; build it with dialectFromUrl or d1MigrationDialect, or pass it through tagDialect first",
    );
  }

  return kind;
}
