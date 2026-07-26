import { useState } from "react";
import { useAuth } from "../lib/auth";
import styles from "./settings.module.css";

function ConfirmLogout({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.confirm}>
      <p>Log out? You can sign back in with your password.</p>
      <div className={styles.actions}>
        <button disabled={busy} onClick={onConfirm} type="button">
          Log out
        </button>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

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
            busy={busy}
            onCancel={() => {
              setConfirming(false);
            }}
            onConfirm={() => {
              setBusy(true);
              void logout();
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
