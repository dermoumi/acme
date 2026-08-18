import type { Kysely } from "kysely";

// A real schema, the way an app declares one: the seed carries the type it was
// written against, which is all `database` asks of it.
interface Main {
  users: { id: string };
}

export default async function seedMain(db: Kysely<Main>): Promise<void> {
  await db.insertInto("users").values({ id: "seeded" }).execute();
}
