#!/usr/bin/env node
// Node resolves neither the workspace's barrels nor its extensionless
// imports. Registered here, so an app needs no tsx of its own.
import { register } from "tsx/esm/api";

register();

const { run } = await import("../acme-deploy.ts");
process.exitCode = await run(process.argv.slice(2));
