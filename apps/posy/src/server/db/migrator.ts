import type { Migrations } from "@acme/db";
import * as init from "./migrations/0001_init";
import * as passwordAuth from "./migrations/0002_password_auth";

// Add new migrations to this record, and never rename a key once it has run.
const migrations: Migrations = {
  "0001_init": init,
  "0002_password_auth": passwordAuth,
};

export default migrations;
