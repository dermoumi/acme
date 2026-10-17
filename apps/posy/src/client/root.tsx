import { getErrorText } from "@acme/app";
import { ErrorBoundary as SentryBoundary } from "@acme/sentry/react";
import type { ReactNode } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  useMatches,
} from "react-router";
import type { Route } from "./+types/root";
import { UpdatePrompt } from "./components";
import { OFFLINE, RetryScreen } from "./routes/offline";
import "./index.css";

export function Layout({ children }: { children: ReactNode }) {
  // The service worker serves this shell at any URL, which its scripts would route.
  const isShell = useMatches().some((match) => match.id === "routes/offline");

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
          name="viewport"
        />
        <meta content="noindex" name="robots" />
        <meta content="#fdf6e8" name="theme-color" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <link href="/apple-touch-icon.png" rel="apple-touch-icon" />
        <title>Posy</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        {isShell ? null : <Scripts />}
      </body>
    </html>
  );
}

export default function Root() {
  return (
    <SentryBoundary>
      <Outlet />
      <UpdatePrompt />
    </SentryBoundary>
  );
}

// What @acme/router hands the boundary for an error Hono caught.
function getReference(error: unknown): string | undefined {
  if (!isRouteErrorResponse(error)) return undefined;

  const data: unknown = error.data;
  if (typeof data !== "object" || data === null || !("reference" in data)) {
    return undefined;
  }

  return typeof data.reference === "string" ? data.reference : undefined;
}

function getMessage(error: unknown): string {
  // A navigation's data fetch fails with a TypeError when the network is down.
  if (error instanceof TypeError) return OFFLINE;

  const status = isRouteErrorResponse(error) ? error.status : 500;
  return getErrorText(status).message;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = getMessage(error);
  const reference = getReference(error);

  return <RetryScreen message={message} reference={reference} />;
}
