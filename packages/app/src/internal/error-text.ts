/**
 * What an error page says for a status.
 */
export interface ErrorText {
  title: string;
  message: string;
}

const STATUS_TEXT: Partial<Record<number, ErrorText>> = {
  401: { title: "Sign in required", message: "Sign in to view this page." },
  403: { title: "No access", message: "You do not have access to this page." },
  404: {
    title: "Page not found",
    message: "There is no page at this address.",
  },
  429: {
    title: "Too many requests",
    message: "Wait a moment, then try again.",
  },
};
const CLIENT_ERROR_TEXT: ErrorText = {
  title: "Request not completed",
  message: "The server could not complete this request.",
};
const SERVER_ERROR_TEXT: ErrorText = {
  title: "Something went wrong",
  message: "The server could not answer this request. Try again in a moment.",
};

/**
 * What an error page says for a status, or the 4xx or 5xx default.
 *
 * Imports nothing, since browser code reaches it through `@acme/app`.
 */
export function getErrorText(status: number): ErrorText {
  const fallback = status < 500 ? CLIENT_ERROR_TEXT : SERVER_ERROR_TEXT;
  return STATUS_TEXT[status] ?? fallback;
}
