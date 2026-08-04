import type { VirusScanProviderId } from "@/config/virusScan";

export type VirusScanResult =
  | { status: "clean" }
  | { status: "infected"; threatName?: string }
  /** The scanner itself couldn't complete (daemon unreachable, timed
   *  out, malformed reply) — deliberately distinct from "infected":
   *  fileStorageService.uploadFile() rejects on either (fail-closed,
   *  the same discipline verifyCronSecret/webhook-signature checks in
   *  this codebase already apply — an upload this app can't confirm is
   *  clean is treated as unsafe, not silently let through), but the
   *  two produce different, honest user-facing messages. */
  | { status: "scan_failed"; reason: string };

export interface VirusScanProvider {
  readonly id: VirusScanProviderId;
  scan(buffer: Buffer): Promise<VirusScanResult>;
}
