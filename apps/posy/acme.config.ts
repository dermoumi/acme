import { type AcmeConfig, defineDbConfig } from "@acme/db/cli";
import type { Database } from "./src/server/db";
import { migrations } from "./src/server/db/migrator";
import { seedUsers } from "./src/server/db/seed";

export default {
  db: defineDbConfig<Database>({
    binding: "DATABASE",
    migrations,
    seed: seedUsers,
  }),
} satisfies AcmeConfig;
