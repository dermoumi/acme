export interface SessionUser {
  id: string;
  name: string;
}

// Network failures throw; a rejected credential resolves to null.
async function readUser(response: Response): Promise<SessionUser | null> {
  if (!response.ok) return null;
  const body = (await response.json()) as { user?: SessionUser | null };
  return body.user ?? null;
}

export async function fetchSession(): Promise<SessionUser | null> {
  return readUser(await fetch("/session"));
}

export async function redeemCode(
  code: string,
  clientVersion: string,
): Promise<SessionUser | null> {
  const response = await fetch("/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, clientVersion }),
  });
  return readUser(response);
}

export async function endSession(): Promise<void> {
  await fetch("/session", { method: "DELETE" });
}
