import { createLogger } from "@/lib/logger";
import type { VirusScanProvider, VirusScanResult } from "../types";

const logger = createLogger({ service: "virusScan.disabled" });
let hasWarned = false;

/**
 * RC-2 — the safe, always-available default: every upload is reported
 * "clean" without ever being scanned. Real (not a stub that throws),
 * matching Email's "console"/WhatsApp's own no-op-default precedent —
 * this app must still function with zero external accounts configured.
 * Logs a warning exactly once per process (not once per upload, which
 * would flood logs) so an operator who never configured real scanning
 * has one clear, findable signal that uploads aren't actually being
 * scanned, rather than a silent, easy-to-miss gap.
 */
export const disabledVirusScanProvider: VirusScanProvider = {
  id: "disabled",
  async scan(): Promise<VirusScanResult> {
    if (!hasWarned) {
      hasWarned = true;
      logger.warn("virus_scan.disabled", {
        message: "VIRUS_SCAN_PROVIDER is not configured — uploads are not being scanned for malware. Set VIRUS_SCAN_PROVIDER=clamav (+ CLAMAV_HOST/CLAMAV_PORT) before accepting real user uploads in production.",
      });
    }
    return { status: "clean" };
  },
};
