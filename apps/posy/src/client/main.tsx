import { ErrorBoundary, initSentryClient } from "@acme/sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./index.css";

initSentryClient({
  environment: import.meta.env.VITE_APP_ENV,
  release: import.meta.env.VITE_APP_VERSION,
  dist: import.meta.env.VITE_APP_REVISION,
});

const root = document.querySelector("#root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
