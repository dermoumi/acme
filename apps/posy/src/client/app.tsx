import { Redirect, Route, Router, Switch } from "wouter";
import { useGuardedLocation } from "./lib/use-guarded-location";
import { CollectionScreen } from "./screens/collection";
import { CraftScreen } from "./screens/craft";
import { LoginScreen } from "./screens/login";
import { PullScreen } from "./screens/pull";
import { SettingsScreen } from "./screens/settings";

export function App() {
  return (
    // oxlint-disable-next-line react/react-compiler -- wouter's API takes the hook itself
    <Router hook={useGuardedLocation}>
      <Switch>
        <Route component={LoginScreen} path="/login" />
        <Route component={PullScreen} path="/" />
        <Route component={CollectionScreen} path="/collection" />
        <Route component={CraftScreen} path="/craft" />
        <Route component={SettingsScreen} path="/settings" />
        <Route>
          <Redirect replace to="/" />
        </Route>
      </Switch>
    </Router>
  );
}
