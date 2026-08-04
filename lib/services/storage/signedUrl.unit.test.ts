import { describe, it, expect } from "vitest";
import { createLocalSignedUrl, verifyLocalSignedUrl } from "./signedUrl";
import { buildContentDispositionHeader } from "./validation";

function parseParams(url: string): { exp: string | null; sig: string | null; mime: string | null; filename: string | null } {
  const query = url.split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  return { exp: params.get("exp"), sig: params.get("sig"), mime: params.get("mime"), filename: params.get("filename") };
}

describe("local signed URL — createLocalSignedUrl / verifyLocalSignedUrl", () => {
  it("round-trips: a freshly created signature verifies successfully", () => {
    const storageKey = "image/test-key.png";
    const url = createLocalSignedUrl(storageKey, 300);
    const { exp, sig, mime, filename } = parseParams(url);
    expect(verifyLocalSignedUrl(storageKey, exp, sig, mime, filename)).not.toBeNull();
  });

  it("round-trips the mimeType/filename, verified and returned intact", () => {
    const storageKey = "document/test-key.pdf";
    const url = createLocalSignedUrl(storageKey, 300, { mimeType: "application/pdf", filename: "Real Report.pdf" });
    const { exp, sig, mime, filename } = parseParams(url);
    const verified = verifyLocalSignedUrl(storageKey, exp, sig, mime, filename);
    expect(verified).toEqual({ mimeType: "application/pdf", filename: "Real Report.pdf" });
  });

  it("pentest — Tampering: rejects a mimeType swapped in after signing", () => {
    const storageKey = "document/test-key.pdf";
    const url = createLocalSignedUrl(storageKey, 300, { mimeType: "application/pdf", filename: "report.pdf" });
    const { exp, sig, filename } = parseParams(url);
    expect(verifyLocalSignedUrl(storageKey, exp, sig, "text/html", filename)).toBeNull();
  });

  it("pentest — Tampering: rejects a filename swapped in after signing", () => {
    const storageKey = "document/test-key.pdf";
    const url = createLocalSignedUrl(storageKey, 300, { mimeType: "application/pdf", filename: "report.pdf" });
    const { exp, sig, mime } = parseParams(url);
    expect(verifyLocalSignedUrl(storageKey, exp, sig, mime, "evil.html")).toBeNull();
  });

  it("rejects a signature computed for a different storageKey", () => {
    const url = createLocalSignedUrl("image/real-key.png", 300);
    const { exp, sig, mime, filename } = parseParams(url);
    expect(verifyLocalSignedUrl("image/different-key.png", exp, sig, mime, filename)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const storageKey = "document/test.pdf";
    const url = createLocalSignedUrl(storageKey, 300);
    const { exp, sig, mime, filename } = parseParams(url);
    const tampered = (sig ?? "").split("").reverse().join("");
    expect(verifyLocalSignedUrl(storageKey, exp, tampered, mime, filename)).toBeNull();
  });

  it("rejects an expired signature", () => {
    const storageKey = "document/expired.pdf";
    const url = createLocalSignedUrl(storageKey, -10); // already expired
    const { exp, sig, mime, filename } = parseParams(url);
    expect(verifyLocalSignedUrl(storageKey, exp, sig, mime, filename)).toBeNull();
  });

  it("rejects when exp/sig are missing entirely", () => {
    expect(verifyLocalSignedUrl("image/key.png", null, null, null, null)).toBeNull();
  });
});

describe("buildContentDispositionHeader", () => {
  it("produces a safe ASCII fallback plus an RFC 5987 percent-encoded real name", () => {
    const header = buildContentDispositionHeader("Q4 Report.pdf");
    expect(header).toBe(`attachment; filename="Q4 Report.pdf"; filename*=UTF-8''Q4%20Report.pdf`);
  });

  it("pentest — Header Injection: strips CRLF/quotes from the ASCII fallback (never re-injects a mid-value quote)", () => {
    const malicious = 'evil"\r\nX-Injected: true\r\n.txt';
    const header = buildContentDispositionHeader(malicious);
    expect(header).not.toContain("\r");
    expect(header).not.toContain("\n");
    // The fallback segment's filename="..." value must contain exactly
    // the two quotes that wrap it — never a third, attacker-controlled
    // one that could close the value early and append raw header text.
    const asciiSegment = header.split(";")[1]!;
    expect(asciiSegment.split('"').length - 1).toBe(2);
  });

  it("pentest — Header Injection: the percent-encoded segment neutralizes CRLF/quotes entirely", () => {
    const malicious = 'evil".txt\r\nX-Injected: true';
    const header = buildContentDispositionHeader(malicious);
    const encodedSegment = header.split("filename*=UTF-8''")[1]!;
    expect(encodedSegment).not.toContain('"');
    expect(encodedSegment).not.toContain("\r");
    expect(encodedSegment).not.toContain("\n");
  });

  it("falls back to a literal 'file' when the name is entirely unsafe characters", () => {
    const header = buildContentDispositionHeader("\x00\x01\x02");
    expect(header).toContain('filename="file"');
  });

  it("supports the inline disposition variant", () => {
    const header = buildContentDispositionHeader("photo.png", "inline");
    expect(header.startsWith("inline;")).toBe(true);
  });
});
