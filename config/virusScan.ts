/**
 * RC-2 — File Security: virus scanning. Single source of truth for
 * provider selection, the same "one env var picks the active adapter"
 * shape config/storage.ts / config/emailChannel.ts already established.
 *
 * Defaults to "disabled" — no ClamAV daemon (or any other real
 * scanning backend) exists in this environment to verify a real
 * adapter against, the same disclosed-honesty posture Cloudinary's
 * storage provider already takes for its own unverified private-URL
 * signing. "disabled" is a real, working, explicitly-named provider
 * (mirrors Email's "console"/WhatsApp's own no-op default) — uploads
 * are never silently unscanned without it being a deliberate,
 * documented configuration choice, not an accidental gap.
 */

export type VirusScanProviderId = "disabled" | "clamav";

const SUPPORTED_PROVIDER_IDS: readonly VirusScanProviderId[] = ["disabled", "clamav"];

function resolveActiveProvider(): VirusScanProviderId {
  const raw = process.env.VIRUS_SCAN_PROVIDER;
  if (raw && (SUPPORTED_PROVIDER_IDS as readonly string[]).includes(raw)) {
    return raw as VirusScanProviderId;
  }
  return "disabled";
}

export const VIRUS_SCAN_ACTIVE_PROVIDER: VirusScanProviderId = resolveActiveProvider();

/** clamd's own real INSTREAM protocol over a plain TCP socket — no
 *  vendor SDK exists for this (it's a local daemon, not a cloud API),
 *  same "hand-rolled protocol" posture this codebase already takes for
 *  Cloudinary's simple documented scheme. Defaults match ClamAV's own
 *  documented default port. */
export const CLAMAV_CONFIG = {
  host: process.env.CLAMAV_HOST || "127.0.0.1",
  port: Number(process.env.CLAMAV_PORT) || 3310,
  timeoutMs: Number(process.env.CLAMAV_TIMEOUT_MS) || 10_000,
};
