import { Socket } from "net";
import { CLAMAV_CONFIG } from "@/config/virusScan";
import type { VirusScanProvider, VirusScanResult } from "../types";

/**
 * RC-2 — real ClamAV `clamd` adapter, over clamd's own documented
 * INSTREAM protocol (a plain TCP socket, no vendor SDK — clamd is a
 * local/network daemon, not a cloud API with an official client
 * library, the same "hand-roll a simple, stable, documented protocol"
 * posture this codebase already takes for Cloudinary's upload signing).
 *
 * INSTREAM wire format (ClamAV's own documented `clamd` protocol):
 *   1. Send `zINSTREAM\0` (a null-terminated command).
 *   2. Send the payload as a series of chunks, each prefixed by its
 *      own length as a 4-byte big-endian unsigned integer.
 *   3. Send one final zero-length chunk (4 zero bytes) to signal EOF.
 *   4. Read clamd's own reply: "stream: OK" (clean), "stream: <name>
 *      FOUND" (infected), or an error string.
 *
 * DISCLOSED: no live clamd daemon exists in this environment to
 * verify this against — the identical honesty CloudinaryStorageProvider's
 * own doc comment already applies to its unverified private-URL
 * signing. The protocol itself is short, stable, and documented
 * (unlike Cloudinary's own authenticated-delivery scheme, which that
 * file's comment notes "has changed shape across SDK versions") —
 * implemented directly from ClamAV's own protocol documentation, not
 * guessed. Verify against a real `clamd` before relying on this in
 * production.
 */
const CHUNK_SIZE = 64 * 1024;

function lengthPrefixedChunk(buffer: Buffer, offset: number): Buffer {
  const end = Math.min(offset + CHUNK_SIZE, buffer.length);
  const chunk = buffer.subarray(offset, end);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(chunk.length, 0);
  return Buffer.concat([header, chunk]);
}

function scanViaClamd(buffer: Buffer): Promise<VirusScanResult> {
  return new Promise((resolve) => {
    const socket = new Socket();
    let settled = false;
    const responseChunks: Buffer[] = [];

    const finish = (result: VirusScanResult): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(CLAMAV_CONFIG.timeoutMs);
    socket.on("timeout", () => finish({ status: "scan_failed", reason: "clamd connection timed out" }));
    socket.on("error", (error) => finish({ status: "scan_failed", reason: `clamd connection error: ${error.message}` }));

    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      let offset = 0;
      while (offset < buffer.length) {
        socket.write(lengthPrefixedChunk(buffer, offset));
        offset += CHUNK_SIZE;
      }
      // Zero-length chunk signals end of stream.
      const eof = Buffer.alloc(4);
      socket.write(eof);
    });

    socket.on("data", (data) => {
      responseChunks.push(data);
    });

    socket.on("end", () => {
      const reply = Buffer.concat(responseChunks).toString("utf8").trim();
      if (reply.includes("FOUND")) {
        const match = /stream:\s*(.+)\s+FOUND/.exec(reply);
        finish({ status: "infected", threatName: match?.[1] });
        return;
      }
      if (reply.includes("OK")) {
        finish({ status: "clean" });
        return;
      }
      finish({ status: "scan_failed", reason: `unexpected clamd reply: ${reply || "(empty)"}` });
    });

    socket.connect(CLAMAV_CONFIG.port, CLAMAV_CONFIG.host);
  });
}

export const clamavVirusScanProvider: VirusScanProvider = {
  id: "clamav",
  scan: scanViaClamd,
};
