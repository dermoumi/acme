import { initSentryClient } from "@acme/sentry/react";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

initSentryClient({
  app: import.meta.env.VITE_APP_NAME,
  environment: import.meta.env.VITE_APP_ENV,
  release: import.meta.env.VITE_APP_VERSION,
  dist: import.meta.env.VITE_APP_REVISION,
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
