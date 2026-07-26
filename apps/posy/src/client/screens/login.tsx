import { useCallback, useEffect, useRef, useState } from "react";
import { Redirect } from "wouter";
import { useAuth } from "../lib/auth";
import styles from "./login.module.css";

const INVALID = "That pairing link is no longer valid. Ask for a fresh one.";
const OFFLINE = "Could not reach Posy. Check your connection and try again.";

function usePairing() {
  const { login } = useAuth();
  const [urlCode] = useState(() =>
    new URLSearchParams(window.location.search).get("code"),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const autoRedeemed = useRef(false);

  const attempt = useCallback(
    async (value: string) => {
      setBusy(true);
      setError("");
      try {
        if (!(await login(value))) setError(INVALID);
      } catch {
        setError(OFFLINE);
      } finally {
        setBusy(false);
      }
    },
    [login],
  );

  useEffect(() => {
    if (!urlCode || autoRedeemed.current) return;
    autoRedeemed.current = true;
    // Codes are single-use: drop it from the URL so a reload cannot replay it.
    window.history.replaceState(null, "", "/login");
    void attempt(urlCode);
  }, [urlCode, attempt]);

  return { attempt, busy, error, urlCode };
}

function CodeForm({
  busy,
  code,
  onChange,
  onSubmit,
}: {
  busy: boolean;
  code: string;
  onChange: (code: string) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <p>Enter your pairing code</p>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          aria-label="Pairing code"
          autoComplete="one-time-code"
          className={styles.code}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder="paste your code"
          value={code}
        />
        <button disabled={busy} type="submit">
          Pair
        </button>
      </form>
    </>
  );
}

export function LoginScreen() {
  const { status } = useAuth();
  const { attempt, busy, error, urlCode } = usePairing();
  const [code, setCode] = useState("");

  if (status === "authed") return <Redirect replace to="/" />;

  return (
    <main className={styles.screen}>
      <h1>Posy</h1>
      {urlCode && !error ? (
        <p>Signing you in…</p>
      ) : (
        <CodeForm
          busy={busy}
          code={code}
          onChange={setCode}
          onSubmit={() => {
            if (code.trim()) void attempt(code.trim());
          }}
        />
      )}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
