import { composeApp } from "@acme/app/testing";
import type { Hono } from "hono";
import { createApp } from "../app";
import type { AppEnv } from "../bindings";

// The entry cannot stand in: importing it would start a server.
export function testApp(): Hono<AppEnv> {
  return composeApp(createApp());
}
