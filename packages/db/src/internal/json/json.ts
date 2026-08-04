/**
 * Serializes a value for a JSON column; {@link parseJsonText} reads it back.
 *
 * Every engine this package supports stores JSON as TEXT, so routing writes through
 * one pair keeps a future engine-specific encoding to a single place.
 */
export function jsonText(value: unknown): string {
  return JSON.stringify(value);
}

/** Parses a value read from a JSON column. Throws `SyntaxError` on invalid JSON. */
export function parseJsonText(text: string): unknown {
  return JSON.parse(text);
}
