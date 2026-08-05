import { defineDb } from "@acme/db";
import type { Database } from "./schema";

/**
 * The request's database: the `DATABASE` D1 binding on Workers, or whatever
 * `DATABASE_URL` names on node. Opened on first use, then held.
 */
export const getDb = defineDb<Database>("DATABASE");
