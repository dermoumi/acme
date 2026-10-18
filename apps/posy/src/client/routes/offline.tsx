import styles from "./offline.module.css";

export const OFFLINE =
  "You are offline. Posy needs a connection to grow your flowers.";

export function RetryScreen({
  message,
  reference,
}: {
  message: string;
  reference?: string;
}) {
  return (
    <main className={styles.screen}>
      <h1>Posy</h1>
      <p>{message}</p>
      {reference ? (
        <p>
          <small>
            Reference: <code>{reference}</code>
          </small>
        </p>
      ) : null}
      {/* A full reload: the shell is served at whatever URL failed. */}
      <a href="">Try again</a>
    </main>
  );
}

export default function Offline() {
  return <RetryScreen message={OFFLINE} />;
}
