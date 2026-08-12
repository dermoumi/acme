/** Hangs the cache off an accessor where only `@acme/db/testing` looks for it. */
export const CACHE = Symbol("acme-db cache");

/** Closes the accessor's database and forgets it. */
export type ClearCache = () => Promise<void>;
