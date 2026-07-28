import { Redirect, Route, Router, Switch } from "wouter";
import styles from "./app.module.css";
import { TabBar, UpdatePrompt } from "./components";
import { AuthProvider, RequireAuth } from "./lib/auth";
import { useGuardedLocation } from "./lib/use-guarded-location";
import {
  CollectionScreen,
  CraftScreen,
  DebugScreen,
  LoginScreen,
  PullScreen,
  SettingsScreen,
} from "./screens";

// Unlisted and absent from production, matching the server routes it drives.
const debug = import.meta.env.VITE_APP_ENV !== "production";

export function App() {
  return (
    <AuthProvider>
      {/* oxlint-disable-next-line react/react-compiler -- wouter's API takes the hook itself */}
      <Router hook={useGuardedLocation}>
        <Switch>
          <Route component={LoginScreen} path="/login" />
          <Route>
            <RequireAuth>
              <div className={styles.content}>
                <Switch>
                  <Route component={PullScreen} path="/" />
                  <Route component={CollectionScreen} path="/collection" />
                  <Route component={CraftScreen} path="/craft" />
                  <Route component={SettingsScreen} path="/settings" />
                  {debug && <Route component={DebugScreen} path="/debug" />}
                  <Route>
                    <Redirect replace to="/" />
                  </Route>
                </Switch>
              </div>
              <TabBar />
            </RequireAuth>
          </Route>
        </Switch>
      </Router>
      <UpdatePrompt />
    </AuthProvider>
  );
}
