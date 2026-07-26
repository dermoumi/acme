export interface SessionUser {
  id: string;
  name: string;
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
  if (!response.ok) throw new Error(`login failed (${response.status})`);
  return readUser(response);
}

export async function endSession(): Promise<void> {
  await fetch("/session", { method: "DELETE" });
}
