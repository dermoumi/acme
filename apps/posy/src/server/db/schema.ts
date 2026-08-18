import type { Generated } from "kysely";

// What gives ctx.var.getDb("DATABASE") its type, declared beside the schema it
// names so nothing has to import one to reach the other.
declare module "@acme/db" {
  interface Databases {
    DATABASE: Database;
  }
}

// All timestamps are unix ms integers.
export interface UsersTable {
  id: string;
  name: string;
  password_hash: string | null;
  created_at: number;
}

// id is the sha-256 hex of the session token; raw tokens are never stored.
export interface SessionsTable {
  id: string;
  user_id: string;
  created_at: number;
  last_seen_at: number;
  client_version: string | null;
}

export interface ItemsTable {
  id: string;
  type: string;
  name: string;
  rarity: string;
  color: string | null;
  tags: string; // JSON string array; @acme/db's jsonText/parseJsonText handle it
  set_id: string;
  art_key: string | null;
  created_at: number;
}

export interface DiscoveriesTable {
  user_id: string;
  item_id: string;
  first_at: number;
}

export interface InventoryTable {
  user_id: string;
  item_id: string;
  count: Generated<number>;
}

export interface LedgerTable {
  id: Generated<number>;
  user_id: string;
  delta: number;
  reason: string;
  ref: string | null;
  created_at: number;
}

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  items: ItemsTable;
  discoveries: DiscoveriesTable;
  inventory: InventoryTable;
  ledger: LedgerTable;
}
