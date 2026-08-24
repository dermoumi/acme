import { serve } from "@acme/app/server";
import { createApp } from "./app";
import type { AppEnv } from "./bindings";

export default serve<AppEnv>((app) => {
  app.route("/", createApp());
});
