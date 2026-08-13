import { close } from "@sentry/node";

// A ceiling, not a wait, for the reason FLUSH_MS is one: a Sentry that cannot
// be reached must not keep a container from stopping.
const DRAIN_MS = 500;

/**
 * Sends what Sentry still holds, on the way out of the process.
 *
 * Nothing else does. The error handler flushes each error before answering its
 * request, so a request-path report is already gone by the time anything shuts
 * down; anything reported OUTSIDE a request is not. A global handler catching
 * an unhandled rejection, a scheduled task, background work: those sit in the
 * queue until the process leaves, and leaving is what discards them.
 *
 * ```ts
 * process.once("SIGTERM", () => {
 *   server.close(() => {
 *     void closeSentry().finally(() => process.exit(0));
 *   });
 * });
 * ```
 *
 * Resolves rather than rejecting, and never spends longer than its ceiling, so
 * a caller can await it on a path that has to finish.
 *
 * Node only: workerd has no process to leave, and its entry does not export it.
 *
 * @param timeoutMs Longest to spend draining. Past it, whatever is left is lost.
 */
export async function closeSentry(timeoutMs = DRAIN_MS): Promise<void> {
  // Closes the client too, so a report after this is dropped rather than queued
  // into a process that is going away.
  await close(timeoutMs).catch(() => false);
}
