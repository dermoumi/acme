import { getKitContext } from "./context";
import type { Kit, KitState } from "./kit";

// Keyed on the kit the app declared, which is one object per declaration: two
// calls to the same factory are two kits, and hold their own.
const held = new WeakMap<Kit, KitState>();

// Every reader comes through here, so the first slot to ask pays for init.
export function getKitState(kit: Kit): KitState {
  const found = held.get(kit);
  if (found !== undefined) {
    return found;
  }

  const state = kit.init?.(getKitContext(kit.name)) ?? {};
  held.set(kit, state);

  return state;
}
