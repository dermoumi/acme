import type { Migrations } from "../../../../migrator";
import { table } from "./table";

export default { "0001_events": table("events") } satisfies Migrations;
