import { useRegisterSW } from "virtual:pwa-register/react";
import styles from "./update-prompt.module.css";

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className={styles.banner} role="status">
      <span>A new version is ready</span>
      <button
        onClick={() => {
          void updateServiceWorker(true);
        }}
        type="button"
      >
        Refresh
      </button>
      <button
        className={styles.dismiss}
        onClick={() => {
          setNeedRefresh(false);
        }}
        type="button"
      >
        Later
      </button>
    </div>
  );
}
