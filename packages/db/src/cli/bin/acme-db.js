#!/usr/bin/env node
// Node resolves neither the barrel nor extensionless imports the workspace
// uses. Registered relative to this file, so an app needs no tsx of its own.
import { register } from "tsx/esm/api";

register();

const { run } = await import("../acme-db.ts");
process.exitCode = await run(process.argv.slice(2));
