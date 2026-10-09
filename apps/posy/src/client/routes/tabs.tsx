import { Outlet } from "react-router";
import { TabBar } from "../components";
import { RequireAuth } from "../lib/auth";
import styles from "./tabs.module.css";

export default function Tabs() {
  return (
    <RequireAuth>
      <div className={styles.content}>
        <Outlet />
      </div>
      <TabBar />
    </RequireAuth>
  );
}
