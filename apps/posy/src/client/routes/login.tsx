import { honoContext } from "@acme/router";
import {
  data,
  Form,
  isRouteErrorResponse,
  redirect,
  useNavigation,
} from "react-router";
import { getSessionUser, signIn } from "../../server/auth";
import type { Route } from "./+types/login";
import styles from "./login.module.css";

const INVALID = "Wrong username or password.";
const TOO_MANY = "Too many sign-in attempts. Try again in a minute.";
const SERVER_ERROR = "Something went wrong. Try again in a moment.";
const OFFLINE = "Could not reach Posy. Check your connection and try again.";

function readField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = await getSessionUser(context.get(honoContext));
  if (user) return redirect("/");

  return null;
}

export async function action({ context, request }: Route.ActionArgs) {
  const form = await request.formData();
  const username = readField(form, "username").trim();
  const password = readField(form, "password");
  const version = readField(form, "clientVersion") || null;

  const ctx = context.get(honoContext);
  const session =
    username && password
      ? await signIn(ctx, username, password, version)
      : null;
  if (!session) return data({ error: INVALID }, { status: 401 });

  return redirect("/", { headers: { "Set-Cookie": session.cookie } });
}

function LoginScreen({ error }: { error?: string }) {
  const busy = useNavigation().state !== "idle";

  return (
    <main className={styles.screen}>
      <h1>Posy</h1>
      <Form
        // oxlint-disable-next-line react/forbid-component-props -- forwarded to the rendered <form>
        className={styles.form}
        method="post"
      >
        <input
          aria-label="Username"
          autoComplete="username"
          className={styles.code}
          name="username"
          placeholder="username"
          required
        />
        <input
          aria-label="Password"
          autoComplete="current-password"
          className={styles.code}
          name="password"
          placeholder="password"
          required
          type="password"
        />
        <input
          name="clientVersion"
          type="hidden"
          value={import.meta.env.VITE_APP_VERSION}
        />
        <button disabled={busy} type="submit">
          Sign in
        </button>
      </Form>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}

export default function Login({ actionData }: Route.ComponentProps) {
  return <LoginScreen error={actionData?.error} />;
}

// Only reached with JS: without it the browser shows whatever the server sent.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const isRateLimited = isRouteErrorResponse(error) && error.status === 429;
  const message = isRateLimited
    ? TOO_MANY
    : error instanceof TypeError
      ? OFFLINE
      : SERVER_ERROR;

  return <LoginScreen error={message} />;
}
