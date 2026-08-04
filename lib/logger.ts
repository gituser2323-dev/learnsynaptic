/**
 * Shared, layer-neutral structured logger — JSON lines to stdout/stderr.
 * The primitive underneath both:
 *  - lib/api/logger.ts's per-request logger (operational logs — request/
 *    response, performance, unhandled errors; ephemeral, stdout-captured)
 *  - lib/services/auditLog's failure logging (a failed *audit write* is
 *    itself an operational concern, not a business event — it must not
 *    go through the AuditLog collection it's reporting on)
 *
 * Neither of those two depends on the other; both depend on this. See
 * AUDIT_ARCHITECTURE.md for the three-way split this supports:
 * Business Audit Events (lib/services/auditLog, persisted, permanent),
 * System/Operational Logs (this file + lib/api/logger.ts, ephemeral),
 * and Future Security Audit Events (planned category, no producer yet).
 */

export interface LogFields {
  [key: string]: unknown;
}

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

function write(level: "info" | "warn" | "error", entry: LogFields): void {
  const line = JSON.stringify({ level, timestamp: new Date().toISOString(), ...entry });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Creates a logger that merges `base` fields into every line — e.g. a
 *  requestId (lib/api/logger.ts) or a service name (lib/services/auditLog). */
export function createLogger(base: LogFields = {}): Logger {
  return {
    info: (event, fields) => write("info", { event, ...base, ...fields }),
    warn: (event, fields) => write("warn", { event, ...base, ...fields }),
    error: (event, fields) => write("error", { event, ...base, ...fields }),
  };
}
