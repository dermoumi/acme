import styles from "./settings.module.css";

const APP_VERSION = "0.1.0";

export function SettingsScreen() {
  return (
    <main>
      <h1>Settings</h1>
      <label className={styles.toggle}>
        <input disabled type="checkbox" /> 3D quality: high
      </label>
      <label className={styles.toggle}>
        <input disabled type="checkbox" /> Reduced motion
      </label>
      <p className={styles.version}>Posy v{APP_VERSION}</p>
    </main>
  );
}
