import { ErrorBoundary as SentryBoundary } from "@acme/sentry/react";
import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, useMatches } from "react-router";
import type { Route } from "./+types/root";
import { UpdatePrompt } from "./components";
import { OFFLINE, RetryScreen } from "./routes/offline";
import "./index.css";

const SERVER_ERROR = "Something went wrong. Try again in a moment.";

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

// A navigation's data fetch fails with a TypeError when the network is down.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = error instanceof TypeError ? OFFLINE : SERVER_ERROR;

  return <RetryScreen message={message} />;
}
