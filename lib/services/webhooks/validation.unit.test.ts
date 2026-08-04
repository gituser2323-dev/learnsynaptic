import { describe, it, expect } from "vitest";
import { validateRegisterEndpointInput, truncateResponseSnippet } from "./validation";

describe("validateRegisterEndpointInput", () => {
  it("accepts valid input with an admin-supplied secret", () => {
    const result = validateRegisterEndpointInput({
      name: "Zapier inbound",
      url: "https://hooks.zapier.com/hooks/catch/123/abc",
      subscribedEventTypes: ["lead.created", "opportunity.won"],
      secret: "a-real-secret-value-16chars",
    });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.name).toBe("Zapier inbound");
    expect(result.data.subscribedEventTypes).toEqual(["lead.created", "opportunity.won"]);
    expect(result.data.secret).toBe("a-real-secret-value-16chars");
  });

  it("accepts the wildcard subscription", () => {
    const result = validateRegisterEndpointInput({ name: "n", url: "https://example.com/hook", subscribedEventTypes: ["*"] });
    expect(result.valid).toBe(true);
  });

  it("omits secret when not supplied, leaving it undefined (registerEndpoint generates one)", () => {
    const result = validateRegisterEndpointInput({ name: "n", url: "https://example.com/hook", subscribedEventTypes: ["*"] });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.secret).toBeUndefined();
  });

  it("rejects a missing name", () => {
    const result = validateRegisterEndpointInput({ url: "https://example.com/hook", subscribedEventTypes: ["*"] });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => e.field === "name")).toBe(true);
  });

  it("rejects a missing url", () => {
    const result = validateRegisterEndpointInput({ name: "n", subscribedEventTypes: ["*"] });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => e.field === "url")).toBe(true);
  });

  it("rejects a malformed url", () => {
    const result = validateRegisterEndpointInput({ name: "n", url: "not a url", subscribedEventTypes: ["*"] });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => e.field === "url")).toBe(true);
  });

  it("rejects a non-http(s) protocol", () => {
    const result = validateRegisterEndpointInput({ name: "n", url: "ftp://example.com/hook", subscribedEventTypes: ["*"] });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => e.field === "url" && e.message.includes("http or https"))).toBe(true);
  });

  it.each([
    "http://localhost/hook",
    "http://127.0.0.1/hook",
    "http://0.0.0.0/hook",
    "http://169.254.169.254/hook", // cloud metadata endpoint (AWS/GCP/Azure) — a classic real SSRF target.
    "http://[::1]/hook",
  ])("rejects a loopback/private-looking SSRF target: %s", (url) => {
    const result = validateRegisterEndpointInput({ name: "n", url, subscribedEventTypes: ["*"] });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => e.field === "url" && e.message.includes("local/loopback"))).toBe(true);
  });

  it.each([
    "http://10.0.0.1/hook",
    "http://10.255.255.255/hook",
    "http://172.16.0.1/hook",
    "http://172.31.255.255/hook",
    "http://192.168.1.1/hook",
    "http://[fe80::1]/hook",
    "http://[fd12:3456:789a::1]/hook",
  ])("pentest — SSRF: rejects an RFC 1918 private-range / IPv6 unique-local/link-local target: %s", (url) => {
    const result = validateRegisterEndpointInput({ name: "n", url, subscribedEventTypes: ["*"] });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => e.field === "url" && e.message.includes("local/loopback"))).toBe(true);
  });

  it.each(["http://172.15.255.255/hook", "http://172.32.0.1/hook", "http://192.169.0.1/hook"])(
    "does NOT falsely reject a public IP just outside the private ranges: %s",
    (url) => {
      const result = validateRegisterEndpointInput({ name: "n", url, subscribedEventTypes: ["*"] });
      expect(result.valid).toBe(true);
    },
  );

  it("rejects an empty subscribedEventTypes array", () => {
    const result = validateRegisterEndpointInput({ name: "n", url: "https://example.com/hook", subscribedEventTypes: [] });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => e.field === "subscribedEventTypes")).toBe(true);
  });

  it("filters out non-string entries from subscribedEventTypes rather than accepting garbage", () => {
    const result = validateRegisterEndpointInput({ name: "n", url: "https://example.com/hook", subscribedEventTypes: ["lead.created", 42, null] });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.subscribedEventTypes).toEqual(["lead.created"]);
  });

  it("rejects a supplied secret shorter than 16 characters", () => {
    const result = validateRegisterEndpointInput({ name: "n", url: "https://example.com/hook", subscribedEventTypes: ["*"], secret: "short" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => e.field === "secret")).toBe(true);
  });

  it("handles non-object input without throwing", () => {
    expect(validateRegisterEndpointInput(null).valid).toBe(false);
    expect(validateRegisterEndpointInput(undefined).valid).toBe(false);
    expect(validateRegisterEndpointInput("a string").valid).toBe(false);
  });
});

describe("truncateResponseSnippet", () => {
  it("leaves a short body untouched", () => {
    expect(truncateResponseSnippet("ok")).toBe("ok");
  });

  it("truncates a body over 500 characters and appends an ellipsis", () => {
    const long = "x".repeat(600);
    const result = truncateResponseSnippet(long);
    expect(result.length).toBe(501);
    expect(result.endsWith("…")).toBe(true);
  });
});
