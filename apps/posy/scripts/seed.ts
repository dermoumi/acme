import type { Kysely } from "kysely";
import type { Database } from "../src/server/db";
import { withDb } from "./d1-util";

const USERS = [
  {
    id: "sdrm",
    name: "sdrm",
    password_hash:
      "pbkdf2$100000$fO3dPCH//A6SXy76wYqHmw==$YwxJ/nKo4LqnrQJLPTJlnWqKSGitZmiP2UVdOiRUC58=",
  },
  {
    id: "sara",
    name: "sara",
    password_hash:
      "pbkdf2$100000$IeZf3nbXcXUbzXUOMWBeFA==$0Vxtu56EzDSe4f3xVyajFlNlns0kLPBhprZtVkfVVfE=",
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
}, process.argv[2]);
