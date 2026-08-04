import "./oauth/testEnv.setup";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { oauthService } from "./oauthService";
import { authService } from "./authService";
import { mfaService } from "./mfaService";
import { generateTotp } from "./totp";
import { IdentityOAuthStateInvalidError, OAuthAccountAlreadyLinkedError, OAuthAccountNotLinkedError } from "./oauth/errors";

/**
 * RC-1 — Social Login. Exercises the real oauthService against a fake
 * "Google" vendor (fetch mocked for the token+userinfo endpoints) —
 * config/identityOAuth.ts's own env vars are stubbed by
 * oauth/testEnv.setup.ts (imported first, see that file's own doc
 * comment for why import order matters here). No test in this file
 * makes a real network call.
 */

let fakeProfile = { providerAccountId: "google-sub-1", email: "person@example.com", email_verified: true, name: "Person" };

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("oauth2.googleapis.com/token")) {
        return { ok: true, json: async () => ({ access_token: "fake-access-token", expires_in: 3600 }) };
      }
      if (url.includes("openidconnect.googleapis.com/v1/userinfo")) {
        return {
          ok: true,
          json: async () => ({ sub: fakeProfile.providerAccountId, email: fakeProfile.email, email_verified: fakeProfile.email_verified, name: fakeProfile.name }),
        };
      }
      throw new Error(`unexpected fetch to ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

let counter = 0;
function uniqueEmail(label: string): string {
  counter += 1;
  return `${label}-${counter}@oauth-test.local`;
}

async function createTestUser(label: string) {
  const email = uniqueEmail(label);
  const result = await authService.createUser({ email, password: "OldPass123", role: "counsellor" });
  if (!result.success) throw new Error(`test setup failed: ${JSON.stringify(result.errors)}`);
  return { email, user: result.user };
}

describe("oauthService.beginAuthorization", () => {
  it("builds a real Google authorize URL carrying a signed state param", () => {
    const url = oauthService.beginAuthorization("google");
    expect(url).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
    expect(new URL(url).searchParams.get("state")).toBeTruthy();
  });

  it("throws for an unknown provider id", () => {
    expect(() => oauthService.beginAuthorization("facebook")).toThrow();
  });
});

describe("oauthService.handleCallback — malformed/tampered state", () => {
  it("rejects garbage state", async () => {
    await expect(oauthService.handleCallback("google", "some-code", "garbage-state")).rejects.toThrow(IdentityOAuthStateInvalidError);
  });

  it("rejects a state minted for a different provider than the URL path claims", async () => {
    const state = oauthService.beginAuthorization("google"); // embeds providerId "google" in its state
    const stateParam = new URL(state).searchParams.get("state")!;
    // Present it against the callback for "microsoft" instead.
    await expect(oauthService.handleCallback("microsoft", "some-code", stateParam)).rejects.toThrow(IdentityOAuthStateInvalidError);
  });
});

describe("oauthService — link then login (the full real flow)", () => {
  it("link intent creates a real OAuthAccount, and a subsequent login intent for the same provider identity signs that user in", async () => {
    const { user } = await createTestUser("link-then-login");
    fakeProfile = { providerAccountId: "google-sub-link-login", email: "linked@example.com", email_verified: true, name: "Linked User" };

    const linkStateUrl = oauthService.beginAuthorization("google", user.id);
    const linkState = new URL(linkStateUrl).searchParams.get("state")!;
    const linkResult = await oauthService.handleCallback("google", "auth-code-1", linkState);
    expect(linkResult.intent).toBe("link");

    const linked = await oauthService.listLinkedAccounts(user.id);
    expect(linked).toHaveLength(1);
    expect(linked[0]!.provider).toBe("google");

    const loginStateUrl = oauthService.beginAuthorization("google");
    const loginState = new URL(loginStateUrl).searchParams.get("state")!;
    const loginResult = await oauthService.handleCallback("google", "auth-code-2", loginState);
    expect(loginResult.intent).toBe("login");
    if (loginResult.intent !== "login") return;
    expect(loginResult.mfaRequired).toBe(false);
    if (loginResult.mfaRequired) return;
    expect(loginResult.user.id).toBe(user.id);
    expect(loginResult.tokens.accessToken).toBeTruthy();
  });

  it("re-linking the same provider identity to the same user is an idempotent no-op (no duplicate account)", async () => {
    const { user } = await createTestUser("relink-same-user");
    fakeProfile = { providerAccountId: "google-sub-relink", email: "relink@example.com", email_verified: true, name: "Relink" };

    for (let i = 0; i < 2; i++) {
      const url = oauthService.beginAuthorization("google", user.id);
      const state = new URL(url).searchParams.get("state")!;
      await oauthService.handleCallback("google", `code-${i}`, state);
    }
    expect(await oauthService.listLinkedAccounts(user.id)).toHaveLength(1);
  });

  it("pentest — Cross-Account Link Hijack: linking a provider identity already linked to ANOTHER user is rejected", async () => {
    const { user: userA } = await createTestUser("hijack-a");
    const { user: userB } = await createTestUser("hijack-b");
    fakeProfile = { providerAccountId: "google-sub-hijack", email: "hijack@example.com", email_verified: true, name: "Hijack" };

    const stateA = new URL(oauthService.beginAuthorization("google", userA.id)).searchParams.get("state")!;
    await oauthService.handleCallback("google", "code-a", stateA);

    const stateB = new URL(oauthService.beginAuthorization("google", userB.id)).searchParams.get("state")!;
    await expect(oauthService.handleCallback("google", "code-b", stateB)).rejects.toThrow(OAuthAccountAlreadyLinkedError);

    // userB never got the account.
    expect(await oauthService.listLinkedAccounts(userB.id)).toHaveLength(0);
  });

  it("login intent with no matching linked account is rejected (never auto-provisions or auto-links by email)", async () => {
    fakeProfile = { providerAccountId: "google-sub-never-linked", email: "never-linked@example.com", email_verified: true, name: "Nobody" };
    const state = new URL(oauthService.beginAuthorization("google")).searchParams.get("state")!;
    await expect(oauthService.handleCallback("google", "code", state)).rejects.toThrow(OAuthAccountNotLinkedError);
  });

  // No test for "login intent against a linked-but-disabled account":
  // UserRepository has no status-mutating method at all yet (staff
  // deactivation is a pre-existing gap outside RC-1's own scope — see
  // UpdateUserInput in types.ts), so there's no legitimate way to
  // construct that state through the public repository interface. The
  // guard itself (`user.status !== "active"` in oauthService.
  // handleCallback) mirrors authService.login()'s own identical check,
  // which IS exercised elsewhere.
});

describe("oauthService — MFA gate on OAuth login", () => {
  it("pentest — MFA Bypass: an MFA-enabled user signing in via OAuth gets a pending challenge, not a session, until a real code is verified", async () => {
    const { user, email } = await createTestUser("oauth-mfa");
    const { secret } = await mfaService.beginSetup(user.id, email);
    const confirmed = await mfaService.confirmSetup(user.id, generateTotp(secret));
    expect(confirmed.success).toBe(true);

    fakeProfile = { providerAccountId: "google-sub-mfa", email: "oauth-mfa-link@example.com", email_verified: true, name: "MFA User" };
    const linkState = new URL(oauthService.beginAuthorization("google", user.id)).searchParams.get("state")!;
    await oauthService.handleCallback("google", "code-link", linkState);

    const loginState = new URL(oauthService.beginAuthorization("google")).searchParams.get("state")!;
    const loginResult = await oauthService.handleCallback("google", "code-login", loginState);
    expect(loginResult.intent).toBe("login");
    if (loginResult.intent !== "login" || !loginResult.mfaRequired) throw new Error("expected mfaRequired");

    const wrongCode = await oauthService.completeMfaChallenge(loginResult.pendingToken, "000000", "google");
    expect(wrongCode.success).toBe(false);

    const rightCode = await oauthService.completeMfaChallenge(loginResult.pendingToken, generateTotp(secret), "google");
    expect(rightCode.success).toBe(true);
    if (rightCode.success) expect(rightCode.user.id).toBe(user.id);
  });
});

describe("oauthService.unlinkAccount", () => {
  it("pentest — Cross-Account Unlink: cannot unlink another user's connected account", async () => {
    const { user: userA } = await createTestUser("unlink-a");
    const { user: userB } = await createTestUser("unlink-b");
    fakeProfile = { providerAccountId: "google-sub-unlink", email: "unlink@example.com", email_verified: true, name: "Unlink" };
    const state = new URL(oauthService.beginAuthorization("google", userA.id)).searchParams.get("state")!;
    await oauthService.handleCallback("google", "code", state);
    const [account] = await oauthService.listLinkedAccounts(userA.id);

    const result = await oauthService.unlinkAccount(userB.id, account!.id);
    expect(result.success).toBe(false);
    expect(await oauthService.listLinkedAccounts(userA.id)).toHaveLength(1);
  });

  it("succeeds for the real owner", async () => {
    const { user } = await createTestUser("unlink-owner");
    fakeProfile = { providerAccountId: "google-sub-unlink-owner", email: "unlink-owner@example.com", email_verified: true, name: "Owner" };
    const state = new URL(oauthService.beginAuthorization("google", user.id)).searchParams.get("state")!;
    await oauthService.handleCallback("google", "code", state);
    const [account] = await oauthService.listLinkedAccounts(user.id);

    const result = await oauthService.unlinkAccount(user.id, account!.id);
    expect(result.success).toBe(true);
    expect(await oauthService.listLinkedAccounts(user.id)).toHaveLength(0);
  });
});
