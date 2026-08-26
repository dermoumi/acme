import { existsSync, readdirSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";

// The stranded half is not a list: the tree is installed and its lockfile still
// names everything, so reachability is all there is to go on.

/**
 * What one prune took out, and what it left behind.
 */
export interface PruneResult {
  /**
   * Store entries matched by name, before reachability was considered.
   */
  named: number;
  /**
   * Store entries nothing reached once the named ones were gone.
   */
  stranded: number;
  /**
   * Store entries still reachable from the tree's own dependencies.
   */
  live: number;
}

/**
 * Every package directory in the virtual store, by its directory name.
 */
function stored(store: string): string[] {
  return readdirSync(store).filter((name) => name !== "node_modules");
}

/**
 * Matches store directories against one argument.
 *
 * pnpm writes `@scope/name` as `@scope+name@version`, so a plain name has to
 * match up to the `@` that starts the version. A trailing `*` matches a prefix
 * instead, which is how one argument covers every platform build of a package.
 */
function matcher(spec: string): (entry: string) => boolean {
  const encoded = spec.replaceAll("/", "+");

  // TODO: Use a glob matcher instead
  return encoded.endsWith("*")
    ? (entry) => entry.startsWith(encoded.slice(0, -1))
    : (entry) => entry.startsWith(`${encoded}@`);
}

/**
 * The store entry a `node_modules` link points into, or null when it leaves the
 * tree. Scoped links resolve the same way, through their own directory.
 */
function entryOf(store: string, link: string): string | null {
  try {
    const relative = path.relative(store, realpathSync(link));

    return relative.startsWith("..")
      ? null
      : (relative.split(path.sep)[0] ?? null);
  } catch {
    return null;
  }
}

function linksIn(nodeModules: string): string[] {
  if (!existsSync(nodeModules)) return [];

  return readdirSync(nodeModules)
    .filter((name) => name !== ".pnpm" && name !== ".bin")
    .flatMap((name) => {
      const entry = path.join(nodeModules, name);

      return name.startsWith("@")
        ? readdirSync(entry).map((scoped) => path.join(entry, scoped))
        : [entry];
    });
}

/**
 * Walks out from the app's own dependencies, the only way into the store.
 */
function reachable(root: string, store: string): Set<string> {
  const seen = new Set<string>();
  const queue = linksIn(path.join(root, "node_modules"))
    .map((link) => entryOf(store, link))
    .filter((entry): entry is string => entry !== null);

  while (queue.length > 0) {
    const entry = queue.pop();
    if (entry === undefined || seen.has(entry)) continue;

    seen.add(entry);
    for (const link of linksIn(path.join(store, entry, "node_modules"))) {
      const next = entryOf(store, link);
      if (next !== null && !seen.has(next)) queue.push(next);
    }
  }

  return seen;
}

function remove(store: string, entries: string[]): void {
  for (const entry of entries) {
    rmSync(path.join(store, entry), { recursive: true, force: true });
  }
}

/**
 * Drops the named packages from a deployed tree, then everything nothing
 * reaches any more.
 *
 * @param drop Package names, or `prefix*` to cover every build of one.
 * @param root The directory holding `node_modules/.pnpm`. Defaults to the
 *   working directory.
 * @throws If there is no store, nothing is named, or a name matches nothing.
 */
export function pruneDeployTree(drop: string[], root = "."): PruneResult {
  if (drop.length === 0) {
    throw new Error("name at least one package to drop");
  }

  const store = path.join(root, "node_modules", ".pnpm");
  if (!existsSync(store)) {
    throw new Error(`no pnpm store to prune: ${store}`);
  }

  // Every argument must hit something, so a rename upstream fails the build
  // rather than quietly leaving the packages it no longer matches installed.
  for (const spec of drop) {
    const matches = matcher(spec);
    const matched = stored(store).filter((entry) => matches(entry));
    if (matched.length === 0) {
      throw new Error(`nothing in the store matches "${spec}"`);
    }

    remove(store, matched);
  }

  const live = reachable(root, store);
  const stranded = stored(store).filter((entry) => !live.has(entry));
  remove(store, stranded);

  return { named: drop.length, stranded: stranded.length, live: live.size };
}
