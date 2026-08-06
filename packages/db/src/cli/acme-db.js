#!/usr/bin/env node
// A loader is unavoidable: the workspace ships TypeScript and imports
// directories, neither of which node resolves on its own. Registered relative
// to this file, so an app need not depend on tsx itself.
import { register } from "tsx/esm/api";

register();
await import("./main.node.ts");
