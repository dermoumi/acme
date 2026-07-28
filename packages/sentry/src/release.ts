function or(value: string | undefined, fallback: string): string {
  return value === undefined || value === "" ? fallback : value;
}

/**
 * Builds the release identifier, in Sentry's `package@version+build` form.
 *
 * ```ts
 * releaseName("posy", "0.1.0", "a1b2c3d"); // "posy@0.1.0+a1b2c3d"
 * ```
 *
 * The name lets Sentry parse the version as semver, and the revision makes each
 * deploy its own release. Without the revision every deploy of an unbumped
 * version shares one release, and release-scoped views become meaningless.
 *
 * Build metadata after `+` is ignored when ordering versions, so these still
 * sort as the version alone.
 *
 * Every side of the app must produce the same string or events and source maps
 * land in different releases, so all of them call this.
 */
export function releaseName(
  name?: string,
  version?: string,
  revision?: string,
): string {
  const build = `${or(version, "dev")}+${or(revision, "dev")}`;
  return name ? `${name}@${build}` : build;
}
