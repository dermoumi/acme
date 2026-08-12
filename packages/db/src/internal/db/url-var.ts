/** The env var a binding reads its url from. Only node ever needs one. */
export function urlVarFor(binding: string, urlVar?: string): string {
  return urlVar ?? `${binding}_URL`;
}
