import { describe, it, expect, afterEach, vi } from "vitest";
import { createServer, type Server, type Socket } from "net";
import type { VirusScanProvider } from "../types";

/**
 * RC-2 — exercises the real clamd INSTREAM wire protocol against a
 * genuine local TCP server (not a mocked `net.Socket`) — this proves
 * the byte-level framing (zINSTREAM\0, length-prefixed chunks, the
 * zero-length EOF chunk) round-trips correctly, the actual thing worth
 * verifying about a hand-rolled protocol implementation with no real
 * clamd daemon available in this environment (see clamav.provider.ts's
 * own disclosed-honesty doc comment).
 */

let activeServer: Server | null = null;

afterEach(() => {
  activeServer?.close();
  activeServer = null;
});

/** Starts a fake clamd on an OS-assigned free port, reassembles
 *  whatever INSTREAM payload the client sends, and replies with a
 *  fixed response string — returning the port to connect to and a
 *  promise resolving to the bytes the server actually reconstructed
 *  (so a test can assert the real file content round-tripped intact
 *  through the chunked framing). */
function startFakeClamd(reply: string | "no-reply" | "abrupt-close"): { port: Promise<number>; received: Promise<Buffer> } {
  let resolveReceived!: (buf: Buffer) => void;
  const received = new Promise<Buffer>((resolve) => {
    resolveReceived = resolve;
  });

  const server = createServer((socket: Socket) => {
    let buffered = Buffer.alloc(0);
    let sawCommand = false;
    const chunks: Buffer[] = [];

    socket.on("data", (data: Buffer) => {
      buffered = Buffer.concat([buffered, data]);

      if (!sawCommand) {
        const commandEnd = buffered.indexOf(0);
        if (commandEnd === -1) return;
        const command = buffered.subarray(0, commandEnd).toString("utf8");
        expect(command).toBe("zINSTREAM");
        buffered = buffered.subarray(commandEnd + 1);
        sawCommand = true;
      }

      // Parse as many complete length-prefixed chunks as are available.
      while (buffered.length >= 4) {
        const length = buffered.readUInt32BE(0);
        if (buffered.length < 4 + length) break;
        const chunk = buffered.subarray(4, 4 + length);
        buffered = buffered.subarray(4 + length);
        if (length === 0) {
          resolveReceived(Buffer.concat(chunks));
          if (reply === "no-reply") return; // simulate a hang — client's own timeout should fire.
          if (reply === "abrupt-close") {
            socket.destroy();
            return;
          }
          socket.end(reply);
          return;
        }
        chunks.push(chunk);
      }
    });
  });

  activeServer = server;
  const port = new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });

  return { port, received };
}

/** config/virusScan.ts's CLAMAV_CONFIG reads process.env at MODULE
 *  EVALUATION time, and each test in this file needs it pointed at a
 *  different ephemeral port — `vi.resetModules()` forces a genuinely
 *  fresh module instance on the next import, re-reading the env vars
 *  just set below. */
async function loadProviderAgainstPort(port: number): Promise<VirusScanProvider> {
  process.env.CLAMAV_HOST = "127.0.0.1";
  process.env.CLAMAV_PORT = String(port);
  process.env.CLAMAV_TIMEOUT_MS = "1000";
  vi.resetModules();
  const mod = await import("./clamav.provider");
  return mod.clamavVirusScanProvider;
}

describe("clamavVirusScanProvider — real INSTREAM wire protocol", () => {
  it("reports clean on a real 'stream: OK' reply, and the server received the exact original bytes", async () => {
    const { port, received } = startFakeClamd("stream: OK\0");
    const provider = await loadProviderAgainstPort(await port);
    const payload = Buffer.from("a".repeat(200_000)); // larger than one 64KB chunk — exercises multi-chunk framing.

    const result = await provider.scan(payload);
    expect(result).toEqual({ status: "clean" });
    expect((await received).equals(payload)).toBe(true);
  });

  it("pentest — EICAR-style detection: reports infected with the parsed threat name on 'FOUND'", async () => {
    const { port } = startFakeClamd("stream: Eicar-Test-Signature FOUND\0");
    const provider = await loadProviderAgainstPort(await port);

    const result = await provider.scan(Buffer.from("fake eicar payload"));
    expect(result).toEqual({ status: "infected", threatName: "Eicar-Test-Signature" });
  });

  it("reports scan_failed on an unrecognized reply", async () => {
    const { port } = startFakeClamd("garbage\0");
    const provider = await loadProviderAgainstPort(await port);

    const result = await provider.scan(Buffer.from("data"));
    expect(result.status).toBe("scan_failed");
  });

  it("fails closed (scan_failed) when the connection is refused", async () => {
    const provider = await loadProviderAgainstPort(1); // port 1 — nothing listens there.
    const result = await provider.scan(Buffer.from("data"));
    expect(result.status).toBe("scan_failed");
  });

  it("fails closed (scan_failed) on an abrupt connection close with no reply", async () => {
    const { port } = startFakeClamd("abrupt-close");
    const provider = await loadProviderAgainstPort(await port);
    const result = await provider.scan(Buffer.from("data"));
    expect(result.status).toBe("scan_failed");
  });

  it("fails closed (scan_failed) on a real timeout when the daemon never replies", async () => {
    const { port } = startFakeClamd("no-reply");
    const provider = await loadProviderAgainstPort(await port);
    const result = await provider.scan(Buffer.from("data"));
    expect(result.status).toBe("scan_failed");
  }, 3000);
});
