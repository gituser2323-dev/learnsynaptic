import { describe, it, expect, vi, afterEach } from "vitest";
import { runStartupValidation } from "./startupValidation";

const REQUIRED_ENV_VARS = [
  "JWT_ACCESS_TOKEN_SECRET",
  "MFA_ENCRYPTION_SECRET",
  "AUTH_OAUTH_STATE_SECRET",
  "TENANT_CREDENTIAL_ENCRYPTION_SECRET",
  "WEBHOOK_SECRET_ENCRYPTION_SECRET",
  "CALENDAR_TOKEN_ENCRYPTION_SECRET",
];
const RECOMMENDED_ENV_VARS = ["CRON_SECRET", "PLATFORM_ADMIN_SECRET", "MONGODB_URI", "ERROR_TRACKING_PROVIDER"];

function setAllConfigured(): void {
  for (const key of [...REQUIRED_ENV_VARS, ...RECOMMENDED_ENV_VARS]) {
    vi.stubEnv(key, "a-real-configured-value");
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("runStartupValidation", () => {
  it("does nothing outside production — this app must still start with zero config for local dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    runStartupValidation();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("logs nothing but a single passing info line when every secret is configured in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    setAllConfigured();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    runStartupValidation();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]![0]).toContain("startup.validation_passed");
  });

  it("pentest — Insecure Defaults: logs a loud error (not a quiet warning) for each required secret left on its dev-only fallback in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    setAllConfigured();
    vi.stubEnv("MFA_ENCRYPTION_SECRET", "");
    vi.stubEnv("WEBHOOK_SECRET_ENCRYPTION_SECRET", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    runStartupValidation();

    expect(errorSpy).toHaveBeenCalledTimes(2);
    const loggedEnvVars = errorSpy.mock.calls.map((call) => JSON.parse(call[0] as string).envVar);
    expect(loggedEnvVars.sort()).toEqual(["MFA_ENCRYPTION_SECRET", "WEBHOOK_SECRET_ENCRYPTION_SECRET"].sort());
  });

  it("logs a warning (not an error) for a missing recommended-but-fail-closed var like CRON_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    setAllConfigured();
    vi.stubEnv("CRON_SECRET", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    runStartupValidation();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warnSpy.mock.calls[0]![0] as string).envVar).toBe("CRON_SECRET");
  });

  it("never throws — a missing secret is surfaced loudly, not a crash that would take down a production deployment", () => {
    vi.stubEnv("NODE_ENV", "production");
    // Deliberately configure NOTHING.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    expect(() => runStartupValidation()).not.toThrow();
  });
});
