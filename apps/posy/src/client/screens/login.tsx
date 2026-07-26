import { useCallback, useState } from "react";
import { Redirect } from "wouter";
import { useAuth } from "../lib/auth";
import styles from "./login.module.css";

const INVALID = "Wrong username or password.";
const OFFLINE = "Could not reach Posy. Check your connection and try again.";

function LoginForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (username: string, password: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (username.trim() && password) onSubmit(username.trim(), password);
      }}
    >
      <input
        aria-label="Username"
        autoComplete="username"
        className={styles.code}
        onChange={(event) => {
          setUsername(event.target.value);
        }}
        placeholder="username"
        value={username}
      />
      <input
        aria-label="Password"
        autoComplete="current-password"
        className={styles.code}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
        placeholder="password"
        type="password"
        value={password}
      />
      <button disabled={busy} type="submit">
        Sign in
      </button>
    </form>
  );
}

export function LoginScreen() {
  const { status, login } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (username: string, password: string) => {
      setBusy(true);
      setError("");
      try {
        if (!(await login(username, password))) setError(INVALID);
      } catch {
        setError(OFFLINE);
      } finally {
        setBusy(false);
      }
    },
    [login],
  );

  if (status === "authed") return <Redirect replace to="/" />;

  return (
    <main className={styles.screen}>
      <h1>Posy</h1>
      <LoginForm
        busy={busy}
        onSubmit={(un, pw) => {
          void submit(un, pw);
        }}
      />
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
