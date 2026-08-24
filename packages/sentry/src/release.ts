function or(value: string | undefined, fallback: string): string {
  return value === undefined || value === "" ? fallback : value;
}

// Sentry's `package@version+build` form. Every side of the app calls this: two
// spellings put its events and its source maps in two different releases.
export function buildReleaseName(
  name?: string,
  version?: string,
  revision?: string,
): string {
  const build = `${or(version, "dev")}+${or(revision, "dev")}`;
  return name ? `${name}@${build}` : build;
}
