import type { ErrorEvent } from "@sentry/cloudflare";

export const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
];

const DENIED = new Set(SENSITIVE_HEADERS);

// Second layer under dataCollection, whose denylists we do not want to have to trust.
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const { request } = event;
  if (!request) return event;

  const { cookies, data, headers, ...rest } = request;
  return {
    ...event,
    request: {
      ...rest,
      ...(headers && {
        headers: Object.fromEntries(
          Object.entries(headers).filter(
            ([name]) => !DENIED.has(name.toLowerCase()),
          ),
        ),
      }),
    },
  };
}
