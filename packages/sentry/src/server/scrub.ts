import type { ErrorEvent } from "@sentry/core";

export const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
];

// Substring matched, so "passwordHash" and "posy_session" are covered too.
export const DEFAULT_REDACT_KEYS = [
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "credential",
  "password",
  "secret",
  "session",
  "token",
];

// Deliberately not Sentry's "[Filtered]": distinct markers show who scrubbed what.
const REDACTED = "[redacted]";
const DENIED_HEADERS = new Set(SENSITIVE_HEADERS);

// Both sides are lowered: callers supply redactKeys in whatever case they like.
function isSensitive(name: string, needles: string[]): boolean {
  const lower = name.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function redactValue(value: unknown, keys: string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => redactValue(item, keys));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([name, inner]: [string, unknown]) => [
        name,
        isSensitive(name, keys) ? REDACTED : redactValue(inner, keys),
      ]),
    );
  }
  return value;
}

function redactQuery(query: string, keys: string[]): string {
  const redacted = new URLSearchParams();
  for (const [name, value] of new URLSearchParams(query)) {
    redacted.append(name, isSensitive(name, keys) ? REDACTED : value);
  }
  return redacted.toString();
}

function contentType(headers: Record<string, string> | undefined): string {
  const found = Object.entries(headers ?? {}).find(
    ([name]) => name.toLowerCase() === "content-type",
  );
  return found?.[1].toLowerCase() ?? "";
}

// A body neither parse understands cannot be masked, only kept whole or dropped.
function redactBody(
  data: unknown,
  keys: string[],
  type: string,
  keepUnparsed: boolean,
): unknown {
  if (typeof data !== "string") return redactValue(data, keys);
  try {
    return JSON.stringify(redactValue(JSON.parse(data) as unknown, keys));
  } catch {
    if (type.includes("application/x-www-form-urlencoded")) {
      return redactQuery(data, keys);
    }
    return keepUnparsed ? data : REDACTED;
  }
}

function redactUrl(url: string, keys: string[]): string {
  const mark = url.indexOf("?");
  if (mark === -1) return url;

  return `${url.slice(0, mark)}?${redactQuery(url.slice(mark + 1), keys)}`;
}

// Dropped, not masked: redactKeys covers header names as it does body keys.
function redactHeaders(
  headers: Record<string, string>,
  keys: string[] = [],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) =>
        !DENIED_HEADERS.has(name.toLowerCase()) && !isSensitive(name, keys),
    ),
  );
}

// dataCollection's header denylist only reaches span attributes, not the event.
export function stripCredentials(event: ErrorEvent): ErrorEvent {
  const { request } = event;
  if (!request) return event;

  const { cookies, headers, ...rest } = request;
  return {
    ...event,
    request: { ...rest, ...(headers && { headers: redactHeaders(headers) }) },
  };
}

// Bodies and query strings are kept for debugging; only sensitive keys are masked.
export function scrubEvent(
  event: ErrorEvent,
  redactKeys: string[],
  keepUnparsedBody = false,
): ErrorEvent {
  const { request } = event;
  if (!request) return event;

  const keys = redactKeys.map((key) => key.toLowerCase());
  const { cookies, data, headers, query_string, url, ...rest } = request;
  return {
    ...event,
    request: {
      ...rest,
      ...(cookies && { cookies: redactValue(cookies, keys) as typeof cookies }),
      ...(url && { url: redactUrl(url, keys) }),
      ...(query_string !== undefined && {
        query_string:
          typeof query_string === "string"
            ? redactQuery(query_string, keys)
            : (redactValue(query_string, keys) as typeof query_string),
      }),
      ...(data !== undefined && {
        data: redactBody(data, keys, contentType(headers), keepUnparsedBody),
      }),
      ...(headers && { headers: redactHeaders(headers, keys) }),
    },
  };
}
