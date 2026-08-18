import type { Seed } from "@acme/db";
import type { Database } from "./schema";

// Throwaway staging credentials. Password for both accounts is "test".
const HASH =
  "pbkdf2$100000$NlNib9alMeDSscJHd7Ru7w==$wvUPPLzOovvQL+zgB+HuGVmUAHpK3gZGxL7//9o17gg=";

const USERS = [
  { id: "sdrm", name: "sdrm", password_hash: HASH },
  { id: "sara", name: "sara", password_hash: HASH },
];

const seedUsers: Seed<Database> = async (db) => {
  await Promise.all(
    USERS.map((user) =>
      db
        .insertInto("users")
        .values({ ...user, created_at: Date.now() })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            name: user.name,
            password_hash: user.password_hash,
          }),
        )
        .execute(),
    ),
  );
  console.log("seeded users");
};

export default seedUsers;
