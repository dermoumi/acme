import { addBreadcrumb, captureMessage } from "@acme/sentry/react";
import { useState } from "react";

interface Actions {
  explode: () => void;
  call: (path: string, request: Promise<Response>) => void;
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`/debug/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const triggers: { label: string; run: (actions: Actions) => void }[] = [
  {
    label: "Render error (ErrorBoundary)",
    run: ({ explode }) => {
      explode();
    },
  },
  {
    label: "Click handler error",
    run: () => {
      throw new Error("debug: click handler error");
    },
  },
  {
    label: "Unhandled promise rejection",
    run: () => {
      void Promise.reject(new Error("debug: unhandled rejection"));
    },
  },
  {
    label: "captureMessage",
    run: () => {
      captureMessage("debug: manual message");
    },
  },
  {
    label: "Error with breadcrumbs",
    run: () => {
      addBreadcrumb({ message: "debug: opened the page", level: "info" });
      addBreadcrumb({ message: "debug: about to throw", level: "warning" });
      throw new Error("debug: error with breadcrumbs");
    },
  },
  {
    label: "Server error (captured)",
    run: ({ call }) => {
      call("boom", fetch("/debug/boom"));
    },
  },
  {
    label: "Server 4xx (must NOT be captured)",
    run: ({ call }) => {
      call("client-error", fetch("/debug/client-error"));
    },
  },
  {
    label: "Server 5xx (must be captured)",
    run: ({ call }) => {
      call("server-error", fetch("/debug/server-error"));
    },
  },
  {
    label: "Post a password (must arrive redacted)",
    run: ({ call }) => {
      call(
        "credentials",
        post("credentials", { username: "tester", password: "hunter2" }),
      );
    },
  },
];

// Thrown during render, so only the ErrorBoundary can catch it.
function Exploding(): never {
  throw new Error("debug: render error");
}

export function DebugScreen() {
  const [exploding, setExploding] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  if (exploding) return <Exploding />;

  const actions: Actions = {
    explode: () => {
      setExploding(true);
    },
    call: (path, request) => {
      void request.then((res) => {
        setLog((lines) => [...lines, `${path}: ${res.status}`]);
      });
    },
  };

  return (
    <main>
      <h1>Sentry debug</h1>
      <p>
        {import.meta.env.VITE_APP_ENV} / {import.meta.env.VITE_APP_VERSION} /{" "}
        {import.meta.env.VITE_APP_REVISION}
      </p>
      <ul>
        {triggers.map(({ label, run }) => (
          <li key={label}>
            <button
              onClick={() => {
                run(actions);
              }}
              type="button"
            >
              {label}
            </button>
          </li>
        ))}
        <li>
          <form action="/debug/form" method="post">
            <button type="submit">Form post, no javascript</button>
          </form>
        </li>
      </ul>
      <pre>{log.join("\n")}</pre>
    </main>
  );
}
