import type { Kysely } from "kysely";
import type { Database } from "../src/server/db";
import { withDb } from "./d1-util";

const USERS = [
  {
    id: "sdrm",
    name: "sdrm",
    password_hash:
      "pbkdf2$200000$5gnl46kyvz9azhMw51Nwrw==$qpwWdKShWLJl8WzZWi/PIG56KOPz4K6/2nxY2jnSxh0=",
  },
  {
    id: "sara",
    name: "sara",
    password_hash:
      "pbkdf2$200000$woXrQpVJyAelSakNfiROhw==$MYpndpepflpuwsG/JhmoBVxqCpElzLepPR2zYvA5rpw=",
  },
];

async function seedUsers(db: Kysely<Database>): Promise<void> {
  await Promise.all(
    USERS.map((user) =>
      db
        .insertInto("users")
        .values({ ...user, created_at: 0 })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            name: user.name,
            password_hash: user.password_hash,
          }),
        )
        .execute(),
    ),
  );
}

await withDb(async (db) => {
  await seedUsers(db);
  console.log("seeded users");
});
