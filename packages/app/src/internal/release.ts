function or(value: string | undefined, fallback: string): string {
  return value === undefined || value === "" ? fallback : value;
}

/**
 * Builds the `name@version+build` string one deployment is known by.
 *
 * Call it rather than spelling the format again: two spellings put an app's
 * events, its source maps and its health body in different releases.
 *
 * @param name Omit for an unprefixed string.
 * @param version Defaults to `dev`.
 * @param revision Defaults to `dev`.
 */
export function buildReleaseName(
  name?: string,
  version?: string,
  revision?: string,
): string {
  const build = `${or(version, "dev")}+${or(revision, "dev")}`;
  return name ? `${name}@${build}` : build;
}
