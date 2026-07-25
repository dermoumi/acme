import { Redirect } from "wouter";
import { useAuth } from "../lib/auth";

export function LoginScreen() {
  const { status, login } = useAuth();

  if (status === "authed") return <Redirect replace to="/" />;

  return (
    <main>
      <h1>Posy</h1>
      <p>Enter your pairing code</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          login();
        }}
      >
        <input
          aria-label="Pairing code"
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="000000"
        />
        <button type="submit">Pair</button>
      </form>
    </main>
  );
}
