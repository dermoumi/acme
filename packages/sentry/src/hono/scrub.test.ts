import type { ErrorEvent } from "@sentry/core";
import { expect, test } from "vitest";
import { DEFAULT_REDACT_KEYS, scrubEvent } from "./scrub";

const SESSION = "DUMMY-SESSION-TOKEN";
const PASSWORD = "DUMMY-PLAINTEXT-PASSWORD";
const NOTE = "a personal message";

function eventWithRequest(): ErrorEvent {
  return {
    type: undefined,
    request: {
      url: `https://posy.test/session?token=${SESSION}&page=3`,
      query_string: `token=${SESSION}&page=3`,
      method: "POST",
      cookies: { posy_session: SESSION },
      data: JSON.stringify({
        username: "tester",
        password: PASSWORD,
        note: NOTE,
      }),
      headers: {
        Cookie: `posy_session=${SESSION}`,
        Authorization: `Bearer ${SESSION}`,
        "User-Agent": "posy-test",
      },
    },
  };
}

function scrub(event = eventWithRequest(), extra: string[] = []) {
  return scrubEvent(event, [...DEFAULT_REDACT_KEYS, ...extra]);
}

test("keeps the request body, masking only sensitive keys", () => {
  const { request } = scrub();
  expect(request?.data).toContain("tester");
  expect(request?.data).toContain(NOTE);
  expect(request?.data).not.toContain(PASSWORD);
});

test("keeps harmless query params, masking sensitive ones", () => {
  const { request } = scrub();
  expect(request?.query_string).toContain("page=3");
  expect(request?.query_string).not.toContain(SESSION);
  expect(request?.url).toContain("page=3");
  expect(request?.url).not.toContain(SESSION);
});

// Sentry's own scrubbing writes [Filtered]; ours stays distinguishable from it.
test("masks with the same marker Sentry itself uses", () => {
  const { request } = scrub();
  expect(request?.data).toContain("[redacted]");
});

test("drops sensitive headers whatever their casing, keeps the rest", () => {
  const { request } = scrub();
  expect(request?.headers).toEqual({ "User-Agent": "posy-test" });
});

test("masks cookie values by name", () => {
  const { request } = scrub();
  expect(request?.cookies?.posy_session).not.toBe(SESSION);
});

test("keeps the url path and method so the failing route stays identifiable", () => {
  const { request } = scrub();
  expect(request?.url).toContain("https://posy.test/session");
  expect(request?.method).toBe("POST");
});

test("masks sensitive keys nested inside objects and arrays", () => {
  const event: ErrorEvent = {
    type: undefined,
    request: {
      data: JSON.stringify({
        user: { name: "tester", credentials: { password: PASSWORD } },
        devices: [
          { id: 1, sessionToken: SESSION },
          { id: 2, label: "phone" },
        ],
      }),
    },
  };
  const body = scrub(event).request?.data as string;
  expect(body).not.toContain(PASSWORD);
  expect(body).not.toContain(SESSION);
  expect(body).toContain("tester");
  expect(body).toContain("phone");
});

test("masks a whole nested object when its own key is sensitive", () => {
  const event: ErrorEvent = {
    type: undefined,
    request: {
      data: JSON.stringify({ session: { id: SESSION, issuedAt: 1000 } }),
    },
  };
  expect(scrub(event).request?.data).not.toContain(SESSION);
});

test("key matching ignores case on both sides", () => {
  const body = (field: string, key: string) => {
    const event: ErrorEvent = {
      type: undefined,
      request: { data: JSON.stringify({ [field]: NOTE, keep: "visible" }) },
    };
    return scrubEvent(event, [key]).request?.data as string;
  };

  const cases: [string, string][] = [
    ["note", "NOTE"],
    ["NOTE", "note"],
    ["nOtE", "NoTe"],
    ["userNote", "note"],
  ];
  for (const [field, key] of cases) {
    expect(body(field, key), `field ${field} / key ${key}`).not.toContain(NOTE);
  }
  expect(body("unrelated", "note")).toContain(NOTE);
  expect(body("note", "NOTE")).toContain("visible");
});

test("redactKeys marks project specific fields as sensitive", () => {
  const { request } = scrub(eventWithRequest(), ["note"]);
  expect(request?.data).toContain("tester");
  expect(request?.data).not.toContain(NOTE);
});

// extras/tags are the sanctioned channel for deliberate, sanitised context.
test("leaves extra and tags untouched", () => {
  const scrubbed = scrub({
    ...eventWithRequest(),
    extra: { failedField: "password" },
    tags: { route: "session" },
  });
  expect(scrubbed.extra).toEqual({ failedField: "password" });
  expect(scrubbed.tags).toEqual({ route: "session" });
});

test("passes through an event carrying no request", () => {
  const event: ErrorEvent = { type: undefined, message: "no request here" };
  expect(scrub(event)).toEqual(event);
});

// This asserted the opposite until 2026-07-28, which is what let a form-posted
// password through. Masking by key is impossible without a parse, so the level
// decides: light keeps it for debugging, full withholds it.
test("withholds a body it cannot parse, unless masking is light", () => {
  const event: ErrorEvent = {
    type: undefined,
    request: { data: "plain text body" },
  };
  expect(scrub(event).request?.data).toBe("[redacted]");
  expect(scrubEvent(event, [], true).request?.data).toBe("plain text body");
});

// A native form post is how login works without javascript; its body is not JSON.
test("masks a form-encoded body by key", () => {
  const { request } = scrubEvent(
    {
      type: undefined,
      request: {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: "username=sara&password=hunter2",
      },
    },
    ["password"],
  );

  expect(request?.data).toContain("username=sara");
  expect(request?.data).not.toContain("hunter2");
});

// A file upload makes the WHOLE form multipart, so this is the shape posy gets
// the moment one lands. light ships it, accepting what full withholds.
test("multipart survives light masking and is withheld by full", () => {
  const event: ErrorEvent = {
    type: undefined,
    request: {
      headers: { "content-type": "multipart/form-data; boundary=x" },
      data: '--x\r\nContent-Disposition: form-data; name="avatar"; filename="cat.png"\r\n\r\nPNG',
    },
  };

  expect(scrubEvent(event, ["password"], true).request?.data).toContain(
    "cat.png",
  );
  expect(scrubEvent(event, ["password"]).request?.data).toBe("[redacted]");
});

// redactKeys visibly applies to bodies, query and cookies; headers behaving
// differently would be a silent gap for a caller who added one.
test("redactKeys drops matching headers, not just body keys", () => {
  const event = {
    type: undefined,
    request: { headers: { "X-Tenant-Id": "acme", accept: "*/*" } },
  } as ErrorEvent;

  expect(scrub(event, ["tenant"]).request?.headers).toEqual({ accept: "*/*" });
  expect(scrub(event).request?.headers).toHaveProperty("X-Tenant-Id");
});
