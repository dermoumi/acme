import { expect, test, vi } from "vitest";
import { endSession, fetchSession, loginWithPassword } from "./api";

function stubFetch(response: Response | Error): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(() =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("fetchSession returns the user or null", async () => {
  stubFetch(jsonResponse({ user: { id: "u1", name: "Tester" } }));
  expect(await fetchSession()).toEqual({ id: "u1", name: "Tester" });

  stubFetch(jsonResponse({ user: null }));
  expect(await fetchSession()).toBeNull();
});

test("loginWithPassword posts username and password", async () => {
  const fetchMock = stubFetch(
    jsonResponse({ user: { id: "u1", name: "Tester" } }),
  );
  expect(await loginWithPassword("u1", "pass", "1.2.3")).toEqual({
    id: "u1",
    name: "Tester",
  });

  const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(path).toBe("/session");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body as string)).toEqual({
    username: "u1",
    password: "pass",
    clientVersion: "1.2.3",
  });
});

test("loginWithPassword resolves null for bad credentials", async () => {
  stubFetch(jsonResponse({ error: "invalid_credentials" }, 401));
  expect(await loginWithPassword("u1", "wrong", "1.2.3")).toBeNull();
});

test("network failures reject instead of looking like bad credentials", async () => {
  stubFetch(new TypeError("offline"));
  await expect(loginWithPassword("u1", "pass", "1.2.3")).rejects.toThrow(
    "offline",
  );
});

test("endSession issues a DELETE", async () => {
  const fetchMock = stubFetch(new Response(null, { status: 204 }));
  await endSession();
  const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(path).toBe("/session");
  expect(init.method).toBe("DELETE");
});
