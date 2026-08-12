import { urlVarFor } from "../../db/url-var";
import { dialectFromUrl } from "../../uri/uri.node.ts";
import { resetPostgres } from "../postgres.node.ts";
import type { CreateEmptyDialect, CreateEmptyEnv } from "./contract";

// The vitest project declares the url it tests, so a suite runs through the same
// dialectFromUrl the app does. Defaults to a private in-memory database.
const url = process.env.ACME_DB_TEST_URL ?? ":memory:";
const needsReset = url.startsWith("postgres:") || url.startsWith("postgresql:");

export const createEmptyDialect: CreateEmptyDialect = async () => {
  if (needsReset) await resetPostgres(url);
  return dialectFromUrl(url);
};

export const createEmptyEnv: CreateEmptyEnv = async (binding, urlVar) => {
  if (needsReset) await resetPostgres(url);
  return { [urlVarFor(binding, urlVar)]: url };
};
