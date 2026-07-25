import { Link, useLocation } from "wouter";
import styles from "./tab-bar.module.css";

const tabs = [
  { href: "/", label: "Pull" },
  { href: "/collection", label: "Collection" },
  { href: "/craft", label: "Craft" },
  { href: "/settings", label: "Settings" },
];

export function TabBar() {
  const [location] = useLocation();

  return (
    <nav className={styles.bar}>
      {tabs.map((tab) => (
        <Link
          // oxlint-disable-next-line react/forbid-component-props -- forwarded to the rendered <a>
          className={
            location === tab.href
              ? `${styles.tab} ${styles.active}`
              : styles.tab
          }
          href={tab.href}
          key={tab.href}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
