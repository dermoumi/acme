export interface SessionUser {
  id: string;
  name: string;
}

// A rejected password resolves `null` and a server fault throws plain, so only
// this one is worth waiting on.
export class LoginRateLimitedError extends Error {
  public readonly retryAfter: number;

  public constructor(retryAfter: number) {
    super(`login rate limited (retry after ${retryAfter}s)`);
    this.name = "LoginRateLimitedError";
    this.retryAfter = retryAfter;
  }
}

const FALLBACK_RETRY_SECONDS = 60;

function retryAfterSeconds(response: Response): number {
  const seconds = Number(response.headers.get("Retry-After"));
  return Number.isFinite(seconds) && seconds > 0
    ? seconds
    : FALLBACK_RETRY_SECONDS;
}

async function readUser(response: Response): Promise<SessionUser | null> {
  const body = (await response.json()) as { user?: SessionUser | null };
  return body.user ?? null;
}

export async function fetchSession(): Promise<SessionUser | null> {
  const response = await fetch("/session");
  if (!response.ok)
    throw new Error(`session check failed (${response.status})`);
  return readUser(response);
}

export async function loginWithPassword(
  username: string,
  password: string,
  clientVersion: string,
): Promise<SessionUser | null> {
  const response = await fetch("/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, clientVersion }),
  });
  if (response.status === 401) return null;
  if (response.status === 429) {
    throw new LoginRateLimitedError(retryAfterSeconds(response));
  }
  if (!response.ok) throw new Error(`login failed (${response.status})`);
  return readUser(response);
}

export async function endSession(): Promise<void> {
  await fetch("/session", { method: "DELETE" });
}
