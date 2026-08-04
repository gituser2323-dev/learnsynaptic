import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * RC-4 — pentest/regression for a real bug found during this pass's own
 * infrastructure audit: getConnection() cached a REJECTED connect()
 * promise forever, so one transient MongoDB outage would permanently
 * break every future call for the rest of the process's lifetime,
 * never attempting to reconnect even after MongoDB recovered. mongoose
 * itself is mocked — this test is about the module's own caching
 * behavior, not Mongoose's real connection machinery.
 */
vi.mock("mongoose", () => ({
  default: { connect: vi.fn() },
}));

describe("getConnection — connection cache retry behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // The cache is deliberately a globalThis singleton (survives HMR/
    // module reload in a real running process) — each test needs a
    // clean slate, not the previous test's cached state.
    delete (globalThis as { __dbConnection?: unknown }).__dbConnection;
  });

  it("retries on the NEXT call after a failed connection attempt, rather than replaying the same rejection forever", async () => {
    const mongoose = (await import("mongoose")).default;
    const connectMock = vi.mocked(mongoose.connect);
    connectMock.mockRejectedValueOnce(new Error("ECONNREFUSED — simulated outage"));
    connectMock.mockResolvedValueOnce(mongoose as never);

    const { getConnection } = await import("./connection");

    await expect(getConnection()).rejects.toThrow("ECONNREFUSED");
    // The real assertion: a SECOND call actually attempts a new
    // connection rather than immediately re-throwing the first's
    // already-settled rejection.
    await expect(getConnection()).resolves.toBeDefined();
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it("reuses the cached connection on success — never reconnects unnecessarily", async () => {
    const mongoose = (await import("mongoose")).default;
    const connectMock = vi.mocked(mongoose.connect);
    connectMock.mockResolvedValue(mongoose as never);

    const { getConnection } = await import("./connection");

    await getConnection();
    await getConnection();
    await getConnection();

    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it("two concurrent callers during a slow first connect share the same in-flight attempt, not two separate connect() calls", async () => {
    const mongoose = (await import("mongoose")).default;
    const connectMock = vi.mocked(mongoose.connect);
    let resolveConnect!: (value: unknown) => void;
    connectMock.mockReturnValue(new Promise((resolve) => { resolveConnect = resolve; }) as never);

    const { getConnection } = await import("./connection");

    const first = getConnection();
    const second = getConnection();
    resolveConnect(mongoose);
    await Promise.all([first, second]);

    expect(connectMock).toHaveBeenCalledTimes(1);
  });
});
