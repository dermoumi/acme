import { expect, test, vi } from "vitest";
import {
  endSession,
  fetchSession,
  LoginRateLimitedError,
  loginWithPassword,
} from "./api";

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

test("server errors on login throw instead of looking like bad credentials", async () => {
  stubFetch(jsonResponse({ error: "internal" }, 500));
  await expect(loginWithPassword("u1", "pass", "1.2.3")).rejects.toThrow("500");
});

test("being rate limited is distinguishable from a server fault", async () => {
  stubFetch(
    new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "30" },
    }),
  );
  await expect(loginWithPassword("u1", "pass", "1.2.3")).rejects.toBeInstanceOf(
    LoginRateLimitedError,
  );

  stubFetch(
    new Response(null, { status: 429, headers: { "Retry-After": "30" } }),
  );
  await expect(loginWithPassword("u1", "pass", "1.2.3")).rejects.toMatchObject({
    retryAfter: 30,
  });
});

test("a rate limit without a usable Retry-After still says how long to wait", async () => {
  stubFetch(jsonResponse({ error: "rate_limited" }, 429));
  await expect(loginWithPassword("u1", "pass", "1.2.3")).rejects.toMatchObject({
    retryAfter: 60,
  });
});

test("network failures reject instead of looking like bad credentials", async () => {
  stubFetch(new TypeError("offline"));
  await expect(loginWithPassword("u1", "pass", "1.2.3")).rejects.toThrow(
    "offline",
  );
});

test("fetchSession throws on server error", async () => {
  stubFetch(jsonResponse({ error: "internal" }, 500));
  await expect(fetchSession()).rejects.toThrow("500");
});

test("endSession issues a DELETE", async () => {
  const fetchMock = stubFetch(new Response(null, { status: 204 }));
  await endSession();
  const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(path).toBe("/session");
  expect(init.method).toBe("DELETE");
});
