import type { DbSourceOptions } from "@acme/db";

/**
 * A database neither runtime can open: node is given no url, workerd no such
 * binding, and the name is one no real config would choose. Resolving it throws,
 * so a test using it proves the request never reached for the database, not
 * merely that it never queried a table.
 */
export const noDatabase: DbSourceOptions = { binding: "__NO_DATABASE__" };
