import type { Dialect } from "kysely";
import { dialectFromUrl } from "../uri/uri.node";
import type { CreateDialectResolver } from "./contract";

export const createDialectResolver: CreateDialectResolver = (options) => {
  let cached: Promise<Dialect> | undefined;

  return () => {
    if (cached) {
      return cached;
    }

    const { url } = options;
    if (!url) {
      throw new Error("no database url: pass `url` to createDbSource");
    }

    // Cleared on failure so a transient one does not poison the source for good.
    cached = dialectFromUrl(url).catch((error: unknown) => {
      cached = undefined;
      throw error;
    });
    return cached;
  };
};
