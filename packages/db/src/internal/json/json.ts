/**
 * Serializes a value for a JSON column; {@link parseJsonText} reads it back.
 *
 * Every engine here stores JSON as TEXT, so routing writes through one pair
 * keeps a future engine-specific encoding in a single place.
 */
export function jsonText(value: unknown): string {
  return JSON.stringify(value);
}

/** Parses a JSON column's value. Throws `SyntaxError` on invalid JSON. */
export function parseJsonText(text: string): unknown {
  return JSON.parse(text);
}
