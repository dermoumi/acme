import { close } from "@sentry/node";

// A ceiling, not a wait, for the reason FLUSH_MS is one: a Sentry that cannot
// be reached must not keep a container from stopping.
const DRAIN_MS = 500;

// Sends what Sentry still holds on the way out. The error handler flushes each
// error before answering, so only reports raised OUTSIDE a request are at risk.
export async function closeSentry(timeoutMs = DRAIN_MS): Promise<void> {
  // Closes the client too, so a report after this is dropped rather than queued
  // into a process that is going away.
  await close(timeoutMs).catch(() => false);
}
