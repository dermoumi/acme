import type { Dialect, DialectAdapter, Kysely } from "kysely";

// D1 answers `sqlite`, which is what it runs.
export type DialectKind = "postgres" | "sqlite";

// Registry symbol, not a module-local one: the node build inlines this package
// into its bundle while the CLI loads it from source, so both must agree.
const KIND = Symbol.for("@acme/db.dialectKind");

interface Tagged {
  [KIND]?: DialectKind;
}

// Tagged in place rather than wrapped, so callers keep whatever they built: a
// wrapper would answer `instanceof SqliteDialect` with false.
export function tagDialect<Source extends Dialect>(
  dialect: Source,
  kind: DialectKind,
): Source {
  // On the adapter: Kysely shares it with the transaction it wraps a migration
  // in, so a tag on the `Kysely` is gone by the time `up()` runs.
  const createAdapter = dialect.createAdapter.bind(dialect);
  dialect.createAdapter = () => {
    const adapter: DialectAdapter & Tagged = createAdapter();
    adapter[KIND] = kind;

    return adapter;
  };

  return dialect;
}

// Reads the tag only, never adapter capabilities: those say what an engine can
// do, not which SQL it writes, so MySQL would silently take sqlite's branch.
export function dialectKind<DB>(db: Kysely<DB>): DialectKind {
  const adapter: DialectAdapter & Tagged = db.getExecutor().adapter;
  const kind = adapter[KIND];
  if (!kind) {
    const message =
      "this database's dialect is untagged, so @acme/db cannot tell which SQL it speaks; build it with dialectFromUrl or d1MigrationDialect, or pass it through tagDialect first";
    throw new Error(message);
  }

  return kind;
}
