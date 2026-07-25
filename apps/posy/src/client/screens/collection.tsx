import { useState } from "react";
import styles from "./collection.module.css";

type CollectionTab = "flowers" | "bouquets";

export function CollectionScreen() {
  const [tab, setTab] = useState<CollectionTab>("flowers");

  const tabClass = (own: CollectionTab) =>
    tab === own ? `${styles.tab} ${styles.active}` : styles.tab;

  return (
    <main>
      <h1>Collection</h1>
      <div className={styles.tabs} role="tablist">
        <button
          aria-selected={tab === "flowers"}
          className={tabClass("flowers")}
          onClick={() => {
            setTab("flowers");
          }}
          role="tab"
          type="button"
        >
          Flowers
        </button>
        <button
          aria-selected={tab === "bouquets"}
          className={tabClass("bouquets")}
          onClick={() => {
            setTab("bouquets");
          }}
          role="tab"
          type="button"
        >
          Bouquets
        </button>
      </div>
      <p>{tab === "flowers" ? "No flowers yet." : "No bouquets yet."}</p>
    </main>
  );
}
