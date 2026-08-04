import { dialectFromUrl } from "../../uri/uri.node";
import { resetPostgres } from "../postgres.node";
import type { CreateEmptyDialect } from "./contract";

// Each vitest project declares the url it tests, so the contract runs through
// the same dialectFromUrl the app does, not a dialect built for testing.
const url = process.env.ACME_DB_TEST_URL ?? ":memory:";

// A private in-memory sqlite is empty by construction; a server keeps whatever
// the last test left behind.
const needsReset = url.startsWith("postgres:") || url.startsWith("postgresql:");

export const createEmptyDialect: CreateEmptyDialect = async () => {
  if (needsReset) await resetPostgres(url);
  return dialectFromUrl(url);
};
