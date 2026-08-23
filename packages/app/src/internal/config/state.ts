import type { Kit, KitState } from "./kit";

// Keyed on the kit the app declared, which is one object per declaration: two
// calls to the same factory are two kits, and hold their own.
const held = new WeakMap<Kit, KitState>();

// Every reader of a kit's state comes through here, so whatever init does is
// paid for by the first slot to ask and by no other.
export function getKitState(kit: Kit): KitState {
  const found = held.get(kit);
  if (found !== undefined) {
    return found;
  }

  const state = kit.init?.() ?? {};
  held.set(kit, state);

  return state;
}
