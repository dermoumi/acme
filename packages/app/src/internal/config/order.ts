import type { Kit } from "./kit";

// An undeclared requirement is no edge: checkKitRequires reports it instead.
function isReady(
  kit: Kit,
  declaredNames: Set<string>,
  settledNames: Set<string>,
) {
  return (kit.requires ?? []).every((one) => {
    return !declaredNames.has(one) || settledNames.has(one);
  });
}

// Every pending kit is blocked by a pending kit, so the walk closes a loop.
function cycleThrough(pendingKits: Kit[]): string[] {
  const byName = new Map(pendingKits.map((kit) => [kit.name, kit]));
  const walkedNames: string[] = [];
  let at = pendingKits[0]?.name;

  while (at !== undefined && !walkedNames.includes(at)) {
    walkedNames.push(at);
    at = (byName.get(at)?.requires ?? []).find((one) => byName.has(one));
  }
  if (at === undefined) return walkedNames;

  return [...walkedNames.slice(walkedNames.indexOf(at)), at];
}

/**
 * Sorts kits so each comes after what it requires, keeping the declared order
 * wherever no requirement forces a move.
 *
 * A requirement the app never declared moves nothing: see checkKitRequires.
 *
 * @throws If the kits require one another in a cycle, naming the ones in it.
 */
export function orderKits(kits: Kit[]): Kit[] {
  const declaredNames = new Set(kits.map((kit) => kit.name));
  const settledNames = new Set<string>();
  const pendingKits = [...kits];
  const orderedKits: Kit[] = [];

  while (pendingKits.length > 0) {
    const next = pendingKits.find((kit) => {
      return isReady(kit, declaredNames, settledNames);
    });
    if (next === undefined) {
      const cycle = cycleThrough(pendingKits).join(" -> ");
      const message = `Kits require one another in a cycle: ${cycle}`;
      throw new Error(message);
    }

    orderedKits.push(next);
    settledNames.add(next.name);
    pendingKits.splice(pendingKits.indexOf(next), 1);
  }

  return orderedKits;
}

export function checkKitRequires(kits: Kit[]): void {
  const declaredNames = new Set(kits.map((kit) => kit.name));

  for (const kit of kits) {
    const missing = (kit.requires ?? []).find((one) => {
      return !declaredNames.has(one);
    });
    if (missing !== undefined) {
      const message = `${kit.name} requires ${missing}, which this app does not declare`;
      throw new Error(message);
    }
  }
}
