import {
  index,
  layout,
  type RouteConfig,
  route,
} from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  layout("routes/tabs.tsx", [
    index("routes/pull.tsx"),
    route("collection", "routes/collection.tsx"),
    route("craft", "routes/craft.tsx"),
    route("settings", "routes/settings.tsx"),
    route("debug", "routes/debug.tsx"),
    route("*", "routes/unknown.ts"),
  ]),
] satisfies RouteConfig;
