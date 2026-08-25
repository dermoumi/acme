/// <reference path="../types.d.ts" />
import virtualConfig from "virtual:acme-config";
import { type AcmeConfig, getKitState } from "../internal/config";

export async function shutdownKits(
  config: AcmeConfig = virtualConfig,
): Promise<void> {
  const closing = (config.kits ?? []).map((kit) => {
    return Promise.resolve(getKitState(kit).shutdown?.());
  });

  await Promise.all(closing);
}
