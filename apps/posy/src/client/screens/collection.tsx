import { useState } from "react";

type CollectionTab = "flowers" | "bouquets";

export function CollectionScreen() {
  const [tab, setTab] = useState<CollectionTab>("flowers");

  return (
    <main>
      <h1>Collection</h1>
      <div role="tablist">
        <button
          aria-selected={tab === "flowers"}
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
