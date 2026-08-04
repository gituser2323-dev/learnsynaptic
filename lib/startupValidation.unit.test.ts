import { describe, it, expect, vi, afterEach } from "vitest";

const REQUIRED_ENV_VARS = [
  "JWT_ACCESS_TOKEN_SECRET",
  "MFA_ENCRYPTION_SECRET",
  "AUTH_OAUTH_STATE_SECRET",
  "TENANT_CREDENTIAL_ENCRYPTION_SECRET",
  "WEBHOOK_SECRET_ENCRYPTION_SECRET",
  "CALENDAR_TOKEN_ENCRYPTION_SECRET",
  // RC-4 — promoted from recommended: the mission's own CRITICAL list
  // names "DATABASE" first (see startupValidation.ts's own doc comment).
  "MONGODB_URI",
];
const RECOMMENDED_ENV_VARS = ["CRON_SECRET", "PLATFORM_ADMIN_SECRET", "ERROR_TRACKING_PROVIDER"];

function setAllConfigured(): void {
  for (const key of [...REQUIRED_ENV_VARS, ...RECOMMENDED_ENV_VARS]) {
    vi.stubEnv(key, "a-real-configured-value");
  }
  // RC-4 — config/storage.ts's STORAGE_ACTIVE_PROVIDER is computed ONCE
  // at module-load time, so every test that needs a specific value must
  // stub the env var BEFORE its own fresh dynamic import below (see
  // beforeEach's vi.resetModules()) — a real, non-"local" provider here
  // so the storage check doesn't fail every other, unrelated test.
  vi.stubEnv("STORAGE_PROVIDER", "aws_s3");
}

/** RC-4 — see setAllConfigured's own comment: STORAGE_ACTIVE_PROVIDER
 *  (and every REQUIRED/RECOMMENDED env var read at module scope) is
 *  frozen at import time, so each test needs its own fresh module
 *  instance reflecting whatever it just stubbed. */
async function loadRunStartupValidation(): Promise<typeof import("./startupValidation").runStartupValidation> {
  vi.resetModules();
  const mod = await import("./startupValidation");
  return mod.runStartupValidation;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("runStartupValidation", () => {
  it("does nothing outside production — this app must still start with zero config for local dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const runStartupValidation = await loadRunStartupValidation();

    runStartupValidation();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("logs nothing but a single passing info line when every secret is configured in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    setAllConfigured();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const runStartupValidation = await loadRunStartupValidation();

    runStartupValidation();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]![0]).toContain("startup.validation_passed");
  });

  it("pentest — Insecure Defaults: logs a loud error (not a quiet warning) for each required secret left on its dev-only fallback in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    setAllConfigured();
    vi.stubEnv("MFA_ENCRYPTION_SECRET", "");
    vi.stubEnv("WEBHOOK_SECRET_ENCRYPTION_SECRET", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const runStartupValidation = await loadRunStartupValidation();

    runStartupValidation();

    expect(errorSpy).toHaveBeenCalledTimes(2);
    const loggedEnvVars = errorSpy.mock.calls.map((call) => JSON.parse(call[0] as string).envVar);
    expect(loggedEnvVars.sort()).toEqual(["MFA_ENCRYPTION_SECRET", "WEBHOOK_SECRET_ENCRYPTION_SECRET"].sort());
  });

  it("RC-4 — logs a loud error (not a quiet warning) for a missing MONGODB_URI in production — silent data loss is a CRITICAL gap, not an availability one", async () => {
    vi.stubEnv("NODE_ENV", "production");
    setAllConfigured();
    vi.stubEnv("MONGODB_URI", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const runStartupValidation = await loadRunStartupValidation();

    runStartupValidation();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(errorSpy.mock.calls[0]![0] as string).envVar).toBe("MONGODB_URI");
  });

  it("logs a warning (not an error) for a missing recommended-but-fail-closed var like CRON_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    setAllConfigured();
    vi.stubEnv("CRON_SECRET", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const runStartupValidation = await loadRunStartupValidation();

    runStartupValidation();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warnSpy.mock.calls[0]![0] as string).envVar).toBe("CRON_SECRET");
  });

  it("never throws — a missing secret is surfaced loudly, not a crash that would take down a production deployment", async () => {
    vi.stubEnv("NODE_ENV", "production");
    // Deliberately configure NOTHING.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const runStartupValidation = await loadRunStartupValidation();

    expect(() => runStartupValidation()).not.toThrow();
  });

  describe("RC-4 — ephemeral local storage in production", () => {
    it("logs a loud error when STORAGE_PROVIDER is unset in production (defaults to the non-durable 'local' provider)", async () => {
      vi.stubEnv("NODE_ENV", "production");
      setAllConfigured();
      vi.stubEnv("STORAGE_PROVIDER", "");
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});
      const runStartupValidation = await loadRunStartupValidation();

      runStartupValidation();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(errorSpy.mock.calls[0]![0] as string).event).toBe("startup.ephemeral_storage_in_production");
    });

    it("logs the same loud error when STORAGE_PROVIDER is explicitly 'local' in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      setAllConfigured();
      vi.stubEnv("STORAGE_PROVIDER", "local");
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});
      const runStartupValidation = await loadRunStartupValidation();

      runStartupValidation();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(errorSpy.mock.calls[0]![0] as string).event).toBe("startup.ephemeral_storage_in_production");
    });

    it("stays silent when STORAGE_PROVIDER is a real durable provider (aws_s3)", async () => {
      vi.stubEnv("NODE_ENV", "production");
      setAllConfigured(); // already stubs STORAGE_PROVIDER=aws_s3
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const runStartupValidation = await loadRunStartupValidation();

      runStartupValidation();

      expect(errorSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("RC-4 — Production Safety Switches: real send providers in a Vercel preview/staging deployment", () => {
    it("warns when a Vercel preview deployment has a real WhatsApp provider active", async () => {
      vi.stubEnv("NODE_ENV", "production"); // Vercel preview builds also get NODE_ENV=production.
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("WHATSAPP_PROVIDER", "meta-cloud-api");
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});
      const runStartupValidation = await loadRunStartupValidation();

      runStartupValidation();

      const calls = warnSpy.mock.calls.map((call) => JSON.parse(call[0] as string));
      expect(calls.some((c) => c.event === "startup.real_provider_in_preview_environment" && c.envVar === "WHATSAPP_PROVIDER")).toBe(true);
      expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining("real_provider"));
    });

    it("warns when a Vercel preview deployment has a real Email provider active", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("EMAIL_PROVIDER", "postmark");
      vi.spyOn(console, "error").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});
      const runStartupValidation = await loadRunStartupValidation();

      runStartupValidation();

      const calls = warnSpy.mock.calls.map((call) => JSON.parse(call[0] as string));
      expect(calls.some((c) => c.event === "startup.real_provider_in_preview_environment" && c.envVar === "EMAIL_PROVIDER")).toBe(true);
    });

    it("stays silent in a preview deployment using the safe console providers (the default)", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VERCEL_ENV", "preview");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});
      const runStartupValidation = await loadRunStartupValidation();

      runStartupValidation();

      const calls = warnSpy.mock.calls.map((call) => JSON.parse(call[0] as string));
      expect(calls.some((c) => c.event === "startup.real_provider_in_preview_environment")).toBe(false);
    });

    it("never fires for a real production deployment (VERCEL_ENV=production), even with real providers active", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("WHATSAPP_PROVIDER", "meta-cloud-api");
      setAllConfigured();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});
      const runStartupValidation = await loadRunStartupValidation();

      runStartupValidation();

      const calls = warnSpy.mock.calls.map((call) => JSON.parse(call[0] as string));
      expect(calls.some((c) => c.event === "startup.real_provider_in_preview_environment")).toBe(false);
    });

    it("also runs (and stays silent when safe) outside production — this check isn't gated by NODE_ENV the way the rest of the file is", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("VERCEL_ENV", "preview");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});
      const runStartupValidation = await loadRunStartupValidation();

      runStartupValidation();

      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
