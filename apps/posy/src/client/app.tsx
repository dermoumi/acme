import { Redirect, Route, Router, Switch } from "wouter";
import styles from "./app.module.css";
import { TabBar } from "./components/tab-bar";
import { AuthProvider, RequireAuth } from "./lib/auth";
import { useGuardedLocation } from "./lib/use-guarded-location";
import { CollectionScreen } from "./screens/collection";
import { CraftScreen } from "./screens/craft";
import { LoginScreen } from "./screens/login";
import { PullScreen } from "./screens/pull";
import { SettingsScreen } from "./screens/settings";

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
    </AuthProvider>
  );
}
