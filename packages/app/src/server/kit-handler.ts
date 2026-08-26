/// <reference path="../types.d.ts" />
import virtualConfig from "virtual:acme-config";
import { type AcmeConfig, getKitState } from "../internal/config";
import type { Handler } from "./contract";

export function wrapWithKits(
  handler: Handler,
  config: AcmeConfig = virtualConfig,
): Handler {
  let wrapped = handler;

  // Right to left, so the first kit the config lists ends up outermost.
  for (const kit of (config.kits ?? []).toReversed()) {
    wrapped = getKitState(kit).handler?.(wrapped) ?? wrapped;
  }

  return wrapped;
}
