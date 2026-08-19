// One file because `Databases` merges once per program: two suites each
// declaring `DATABASE` would disagree about its type. An app declares once.
export interface Items {
  items: { id: string };
}

declare module "../../db/get-db" {
  interface Databases {
    DATABASE: Items;
    OTHER: Items;
  }
}
