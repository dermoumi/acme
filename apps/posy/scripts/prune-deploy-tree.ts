import { existsSync, readdirSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";

// TODO: Make this a cli command in @acme/app, use cac

// The stranded half is not a list: the tree is installed and its lockfile still
// names everything, so reachability is all there is to go on.

const USAGE =
  "usage: prune-deploy-tree <deployed directory> <package|prefix*>...";

function args(): { root: string; drop: string[] } {
  const [root, ...drop] = process.argv.slice(2);
  if (!root || drop.length === 0) {
    throw new Error(USAGE);
  }

  return { root, drop };
}

const { root, drop } = args();
const store = path.join(root, "node_modules", ".pnpm");
if (!existsSync(store)) {
  throw new Error(`no pnpm store to prune: ${store}`);
}

/** Every package directory in the virtual store, by its directory name. */
function stored(): string[] {
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
function entryOf(link: string): string | null {
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

/** Walks out from the app's own dependencies, the only way into the store. */
function reachable(): Set<string> {
  const seen = new Set<string>();
  const queue = linksIn(path.join(root, "node_modules"))
    .map((link) => entryOf(link))
    .filter((entry): entry is string => entry !== null);

  while (queue.length > 0) {
    const entry = queue.pop();
    if (entry === undefined || seen.has(entry)) continue;
    seen.add(entry);
    for (const link of linksIn(path.join(store, entry, "node_modules"))) {
      const next = entryOf(link);
      if (next !== null && !seen.has(next)) queue.push(next);
    }
  }

  return seen;
}

function remove(entries: string[]): void {
  for (const entry of entries) {
    rmSync(path.join(store, entry), { recursive: true, force: true });
  }
}

// Every argument must hit something, so a rename upstream fails the build
// rather than quietly leaving the packages it no longer matches installed.
for (const spec of drop) {
  const matches = matcher(spec);
  const matched = stored().filter((entry) => matches(entry));
  if (matched.length === 0) {
    throw new Error(`nothing in the store matches "${spec}"`);
  }
  remove(matched);
}

const live = reachable();
const stranded = stored().filter((entry) => !live.has(entry));
remove(stranded);

console.log(
  `pruned ${drop.length} named, ${stranded.length} stranded, ${live.size} left`,
);
