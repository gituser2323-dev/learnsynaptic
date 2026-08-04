import { describe, it, expect } from "vitest";
import { validateIntegrationConfig, validateCredentialRef } from "./validation";

/**
 * Integrations Hub (Phase 6), Module 6.1 — the one real security guard
 * behind "do not store secrets directly in normal database fields":
 * config keys that look credential-shaped are rejected outright.
 */
describe("validateIntegrationConfig", () => {
  it("accepts an empty/undefined config", () => {
    expect(validateIntegrationConfig(undefined)).toEqual({ valid: true, data: {} });
    expect(validateIntegrationConfig(null)).toEqual({ valid: true, data: {} });
  });

  it("accepts a plain, non-credential-shaped config object", () => {
    const result = validateIntegrationConfig({ displayName: "Team Slack", channel: "#leads" });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data).toEqual({ displayName: "Team Slack", channel: "#leads" });
  });

  it.each(["apiKey", "secret", "accessToken", "password", "clientSecret", "credential"])(
    "rejects a config key that looks credential-shaped: %s",
    (key) => {
      const result = validateIntegrationConfig({ [key]: "whatever" });
      expect(result.valid).toBe(false);
    },
  );

  it("rejects a non-object config", () => {
    expect(validateIntegrationConfig("not an object").valid).toBe(false);
    expect(validateIntegrationConfig(["array", "not", "object"]).valid).toBe(false);
  });
});

describe("validateCredentialRef", () => {
  it("accepts undefined (no credentialRef supplied)", () => {
    const result = validateCredentialRef(undefined);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data).toBeUndefined();
  });

  it("accepts a well-formed 'none' ref", () => {
    const result = validateCredentialRef({ type: "none" });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data).toEqual({ type: "none" });
  });

  it("accepts a well-formed 'env' ref", () => {
    const result = validateCredentialRef({ type: "env", description: "Uses SLACK_WEBHOOK_URL" });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data).toEqual({ type: "env", description: "Uses SLACK_WEBHOOK_URL" });
  });

  it("rejects an 'env' ref with no description", () => {
    expect(validateCredentialRef({ type: "env" }).valid).toBe(false);
  });

  it("accepts a well-formed 'vault' ref", () => {
    const result = validateCredentialRef({ type: "vault", ref: "vault://integrations/slack" });
    expect(result.valid).toBe(true);
  });

  it("rejects a 'vault' ref with no ref string", () => {
    expect(validateCredentialRef({ type: "vault" }).valid).toBe(false);
  });

  it("rejects an unrecognized type", () => {
    expect(validateCredentialRef({ type: "carrier_pigeon" }).valid).toBe(false);
  });

  it("rejects a non-object value", () => {
    expect(validateCredentialRef("a string").valid).toBe(false);
  });
});
