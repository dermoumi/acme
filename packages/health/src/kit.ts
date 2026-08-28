import { buildReleaseName, type Kit } from "@acme/app";
import type { Context } from "hono";

declare module "@acme/app" {
  interface KitShared {
    addHealthStatus: AddHealthStatus;
  }
}

const DEFAULT_PATH = "/health";
// Presence is the flag: `?full` carries no value, and any value means this.
const FULL = "full";

/**
 * What one contributor answers when the endpoint is asked.
 *
 * Called per request, so it may query what it reports on.
 */
// Unparameterised: neither end of this boundary can name the other's bindings.
export type HealthStatus = (ctx: Context) => unknown;

/**
 * What {@link AddHealthStatus} takes beyond the status itself.
 */
export interface HealthStatusOptions {
  /**
   * Whether this is detail rather than verdict, which leaves it out of the
   * short body a periodic probe reads.
   */
  optional?: boolean;
}

/**
 * Offers one line of the endpoint's body, under a key the calling kit owns.
 *
 * Reached with `require("addHealthStatus")` from a kit's `init`, so the app has
 * to declare this kit ahead of whoever contributes. Registering a key twice
 * replaces it, leaving its place in the body alone.
 */
export type AddHealthStatus = (
  key: string,
  status: HealthStatus,
  options?: HealthStatusOptions,
) => void;

/**
 * What the health kit takes.
 */
export interface HealthConfig {
  /**
   * Where the endpoint answers. Defaults to `/health`.
   */
  path?: string;
}

interface Contribution {
  key: string;
  status: HealthStatus;
  optional: boolean;
}

// What a deployment stamps: a worker's vars, a node process's environment.
interface Identity {
  APP_NAME?: string;
  APP_VERSION?: string;
  APP_REVISION?: string;
}

// Insertion ordered, and replacing a key keeps its place, so the body stays in
// one order for whoever diffs two deployments.
const contributions = new Map<string, Contribution>();

const addHealthStatus: AddHealthStatus = (key, status, options = {}) => {
  contributions.set(key, { key, status, optional: options.optional ?? false });
};

// A contributor that throws must not take the endpoint down: liveness is that
// it answered at all, and its own line carries the bad news.
async function answer(
  { key, status }: Contribution,
  ctx: Context,
): Promise<[string, unknown]> {
  try {
    return [key, await status(ctx)];
  } catch {
    return [key, "error"];
  }
}

async function buildHealthBody(
  ctx: Context,
  full: boolean,
): Promise<Record<string, unknown>> {
  // Both hosts always pass one; an app built in hand for a test may not.
  const env = (ctx.env ?? {}) as Identity;
  const asked = [...contributions.values()].filter((one) => {
    return full || !one.optional;
  });
  const lines = await Promise.all(asked.map(async (one) => answer(one, ctx)));

  return {
    status: "ok",
    release: buildReleaseName(env.APP_NAME, env.APP_VERSION, env.APP_REVISION),
    ...Object.fromEntries(lines),
  };
}

/**
 * The health kit: one endpoint saying whether this deployment works.
 *
 * `status` and `release` are always answered; every other line is what a kit
 * offered through {@link AddHealthStatus}, which this kit registers for the
 * others to require. The ones offered as detail answer only when the request
 * carries `?full`, so a periodic probe pays for the verdict alone and a deploy
 * check reads the whole breakdown.
 *
 * `status` says the endpoint answered, not that every contributor is happy: a
 * degraded app that still serves must not be killed by its own liveness probe.
 *
 * The flag is not access control, so nothing behind it may be sensitive.
 *
 * Declare it before its contributors, and before any kit mounting a catch-all,
 * which would answer instead.
 */
export function healthKit(config: HealthConfig = {}): Kit {
  return {
    name: "@acme/health",
    config,
    init: ({ register }) => {
      register("addHealthStatus", addHealthStatus);

      return {
        routes: (app) => {
          app.get(config.path ?? DEFAULT_PATH, async (ctx) => {
            return ctx.json(
              await buildHealthBody(ctx, ctx.req.query(FULL) !== undefined),
            );
          });
        },
      };
    },
  };
}
