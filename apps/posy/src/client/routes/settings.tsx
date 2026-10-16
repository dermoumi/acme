import { honoContext } from "@acme/router";
import { useState } from "react";
import {
  Form,
  redirect,
  useNavigation,
  useRouteLoaderData,
} from "react-router";
import { signOut } from "../../server/auth";
import type { Route } from "./+types/settings";
import type { loader as tabsLoader } from "./tabs";
import styles from "./settings.module.css";

export async function action({ context }: Route.ActionArgs) {
  const cookie = await signOut(context.get(honoContext));

  return redirect("/login", { headers: { "Set-Cookie": cookie } });
}

function ConfirmLogout({ onCancel }: { onCancel: () => void }) {
  const busy = useNavigation().state !== "idle";

  return (
    <div className={styles.confirm}>
      <p>Log out? You can sign back in with your password.</p>
      <Form
        // oxlint-disable-next-line react/forbid-component-props -- forwarded to the rendered <form>
        className={styles.actions}
        method="post"
      >
        <button disabled={busy} type="submit">
          Log out
        </button>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
      </Form>
    </div>
  );
}

export default function SettingsScreen() {
  const user = useRouteLoaderData<typeof tabsLoader>("routes/tabs")?.user;
  const [confirming, setConfirming] = useState(false);

  return (
    <main>
      <h1>Settings</h1>
      <label className={styles.toggle}>
        <input disabled type="checkbox" /> 3D quality: high
      </label>
      <label className={styles.toggle}>
        <input disabled type="checkbox" /> Reduced motion
      </label>

      <section className={styles.account}>
        {user ? <p>Signed in as {user.name}</p> : null}
        {confirming ? (
          <ConfirmLogout
            onCancel={() => {
              setConfirming(false);
            }}
          />
        ) : (
          <button
            onClick={() => {
              setConfirming(true);
            }}
            type="button"
          >
            Log out
          </button>
        )}
      </section>

      <p className={styles.version}>Posy v{import.meta.env.VITE_APP_VERSION}</p>
    </main>
  );
}
