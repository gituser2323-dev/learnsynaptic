/**
 * RC-1 — a minimal, dependency-free User-Agent parser: just enough to
 * show "Chrome on macOS" in the Active Sessions panel, not a general-
 * purpose UA-sniffing library. Order matters throughout (checked most-
 * specific-first, e.g. Edge/Chromium contains "Chrome" in its own UA
 * string, so it must be checked before the generic Chrome match, and
 * iOS/iPadOS Safari's own UA string contains "like Mac OS X" ahead of
 * the real OS token). Falls back to a generic label rather than
 * guessing — an unrecognized UA is shown as "Unknown browser"/"Unknown
 * device," never mislabeled with false confidence.
 */

export interface ParsedUserAgent {
  browser: string;
  os: string;
  deviceName: string;
}

const BROWSER_PATTERNS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Firefox\//, "Firefox"],
  [/CriOS\//, "Chrome"],
  [/FxiOS\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const OS_PATTERNS: [RegExp, string][] = [
  [/Windows NT/, "Windows"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Mac OS X/, "macOS"],
  [/Android/, "Android"],
  [/CrOS/, "Chrome OS"],
  [/Linux/, "Linux"],
];

export function parseUserAgent(userAgent: string | null): ParsedUserAgent {
  if (!userAgent) return { browser: "Unknown browser", os: "Unknown OS", deviceName: "Unknown device" };

  const browser = BROWSER_PATTERNS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? "Unknown browser";
  const os = OS_PATTERNS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? "Unknown OS";
  const isMobile = /Mobile|Android|iPhone/.test(userAgent) && !/iPad/.test(userAgent);
  const isTablet = /iPad|Tablet/.test(userAgent);

  const deviceName = `${browser} on ${os}${isTablet ? " (tablet)" : isMobile ? " (mobile)" : ""}`;
  return { browser, os, deviceName };
}
