import { ErrorBoundary } from "@acme/sentry/react";
import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts } from "react-router";
import { UpdatePrompt } from "./components";
import { AuthProvider } from "./lib/auth";
import "./index.css";

export function Layout({ children }: { children: ReactNode }) {
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
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Outlet />
        <UpdatePrompt />
      </AuthProvider>
    </ErrorBoundary>
  );
}
