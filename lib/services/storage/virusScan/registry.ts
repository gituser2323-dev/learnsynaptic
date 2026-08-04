import { VIRUS_SCAN_ACTIVE_PROVIDER } from "@/config/virusScan";
import { disabledVirusScanProvider } from "./providers/disabled.provider";
import { clamavVirusScanProvider } from "./providers/clamav.provider";
import type { VirusScanProvider } from "./types";
import type { VirusScanProviderId } from "@/config/virusScan";

/** The single seam where VIRUS_SCAN_PROVIDER becomes a concrete
 *  VirusScanProvider instance — the same shape every other vendor
 *  registry in this app already established. virusScanService.ts is
 *  the only caller. */
const registry: Record<VirusScanProviderId, VirusScanProvider> = {
  disabled: disabledVirusScanProvider,
  clamav: clamavVirusScanProvider,
};

export function getVirusScanProvider(): VirusScanProvider {
  return registry[VIRUS_SCAN_ACTIVE_PROVIDER];
}
