import type { KitVite } from "@acme/app/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import type { Plugin, PluginOption } from "vite";
// Extension included: node loads this file directly when vite reads its config.
import { buildReleaseName } from "../release.ts";

export interface SentryViteOptions {
  /**
   * App name, e.g. `posy`. Prefixes the release. Defaults to `APP_NAME`.
   */
  app?: string;
  /**
   * Sentry org slug. Defaults to `SENTRY_ORG`.
   */
  org?: string;
  /**
   * Sentry project slug. Defaults to `SENTRY_PROJECT`.
   */
  project?: string;
  /**
   * Upload token. Defaults to `SENTRY_AUTH_TOKEN`; absent disables upload.
   */
  authToken?: string;
  /**
   * Release the maps belong to. Defaults to `APP_VERSION`.
   */
  release?: string;
  /**
   * Build the maps belong to. Defaults to `APP_REVISION`.
   */
  dist?: string;
}

// Nothing to upload to means nothing to emit: hidden maps otherwise ship an
// unreferenced .map next to every chunk.
function sourcemapPlugin(enabled: boolean): Plugin {
  return {
    name: "@acme/sentry/sourcemap",
    config: () => ({ build: { sourcemap: enabled ? "hidden" : false } }),
  };
}

/**
 * Uploads source maps so stack traces point at your code rather than the
 * bundle. Add it after the other plugins in `vite.config.ts`.
 *
 * Inert without `SENTRY_AUTH_TOKEN`, which is the normal state locally: no maps
 * are emitted and no upload is attempted. `release` and `dist` must match what
 * the running app reports, or Sentry will not find the maps for an event.
 *
 * Uploaded maps are deleted from the build output afterwards, so `hidden` maps
 * never reach the browser.
 *
 * Also associates the release with its commits, which needs full git history:
 * CI must not use a shallow clone.
 */
export function sentryVite(options: SentryViteOptions = {}): PluginOption {
  const authToken = options.authToken ?? process.env.SENTRY_AUTH_TOKEN;

  return [
    sourcemapPlugin(Boolean(authToken)),
    sentryVitePlugin({
      org: options.org ?? process.env.SENTRY_ORG,
      project: options.project ?? process.env.SENTRY_PROJECT,
      authToken,
      release: {
        name: buildReleaseName(
          options.app ?? process.env.APP_NAME,
          options.release ?? process.env.APP_VERSION,
          options.dist ?? process.env.APP_REVISION,
        ),
        dist: options.dist ?? process.env.APP_REVISION ?? "dev",
        // Never fail a build over monitoring: shallow clones have no range to diff.
        setCommits: { auto: true, ignoreMissing: true, ignoreEmpty: true },
      },
      sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
      disable: !authToken,
    }),
  ];
}

// What the kit declares as its `vite`, so an app lists no plugin of its own.
const kitVite: KitVite = ({ app }) => {
  return sentryVite({
    app: app.name,
    release: app.version,
    dist: app.revision,
  });
};

export default kitVite;
