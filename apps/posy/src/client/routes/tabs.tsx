import { honoContext } from "@acme/router";
import { Outlet, redirect } from "react-router";
import { getSessionUser } from "../../server/auth";
import { TabBar } from "../components";
import type { Route } from "./+types/tabs";
import styles from "./tabs.module.css";

export async function loader({ context }: Route.LoaderArgs) {
  const user = await getSessionUser(context.get(honoContext));
  if (!user) return redirect("/login");

  return { user };
}

export default function Tabs() {
  return (
    <>
      <div className={styles.content}>
        <Outlet />
      </div>
      <TabBar />
    </>
  );
}
