import type { Migrations } from "../../../../migrator";
import { table } from "./table";

export default {
  "0001_users": table("users"),
  "0002_posts": table("posts"),
} satisfies Migrations;
