import { urlVarFor } from "../db/url-var.node";
import { dialectFromUrl } from "../uri/uri.node";
import type { ResolveDialect } from "./contract";

export const resolveDialect: ResolveDialect = (env, binding, urlVar) => {
  const name = urlVarFor(binding, urlVar);
  const url = (env as Record<string, unknown>)[name];
  if (typeof url !== "string" || !url) {
    throw new Error(`no database url: set ${name} on the environment`);
  }

  return dialectFromUrl(url);
};
