/** The env var a binding reads its url from, on node. Never seen by workerd. */
export function urlVarFor(binding: string, urlVar?: string): string {
  return urlVar ?? `${binding.toUpperCase()}_URL`;
}
