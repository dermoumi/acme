import { Link, useLocation } from "react-router";
import styles from "./tab-bar.module.css";

const tabs = [
  { href: "/", label: "Pull" },
  { href: "/collection", label: "Collection" },
  { href: "/craft", label: "Craft" },
  { href: "/settings", label: "Settings" },
];

export function TabBar() {
  const { pathname } = useLocation();

  return (
    <nav className={styles.bar}>
      {tabs.map((tab) => (
        <Link
          // oxlint-disable-next-line react/forbid-component-props -- forwarded to the rendered <a>
          className={
            pathname === tab.href
              ? `${styles.tab} ${styles.active}`
              : styles.tab
          }
          key={tab.href}
          to={tab.href}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
