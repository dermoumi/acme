const APP_VERSION = "0.1.0";

export function SettingsScreen() {
  return (
    <main>
      <h1>Settings</h1>
      <label>
        <input disabled type="checkbox" /> 3D quality: high
      </label>
      <label>
        <input disabled type="checkbox" /> Reduced motion
      </label>
      <p>Posy v{APP_VERSION}</p>
    </main>
  );
}
