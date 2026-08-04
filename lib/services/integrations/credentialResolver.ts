import { getIntegrationConnectionRepository } from "@/lib/db";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { decryptCredentialValue } from "./credentialCrypto";

/**
 * Business OS Phase 8, Module 8.2 — the one place a provider adapter
 * asks "what is MY organization's credential for this provider, for
 * this key" instead of reading process.env-backed config directly.
 * Checks the given org's stored `tenant_secret` credential first;
 * returns `undefined` (never another org's value, never a thrown
 * error) when none exists — the caller falls back to its own existing
 * env var, which is what makes adopting this resolver 100%
 * backward-compatible: an org with no tenant credential configured
 * keeps working exactly as it did before this module existed.
 *
 * `organizationId` is always the caller's own explicit argument, never
 * read from ambient AsyncLocalStorage state here — this keeps the
 * resolver safe to call from background jobs that resolved their own
 * org as a plain value (scheduler/automation/webhook processing, per
 * Module 8.1's own `runWithTenantContext` per-job pattern), and means
 * a caller can never accidentally resolve "whatever context happens to
 * be active" for a security-sensitive lookup. Internally it still
 * wraps the actual repository read in `runWithTenantContext` for that
 * exact organizationId — the same tenant-scoped query path every other
 * repository call in this app goes through (Module 8.1's
 * `tenantScopePlugin`/in-memory scope helpers) — rather than adding a
 * second, resolver-specific lookup mechanism. This also means a wrong
 * or forged `organizationId` argument can only ever resolve that
 * org's own row, never leak across tenants through this function.
 */
export async function resolveTenantCredential(organizationId: string, providerId: string, key: string): Promise<string | undefined> {
  const repository = await getIntegrationConnectionRepository();
  const connection = await runWithTenantContext({ organizationId }, () => repository.findByProviderId(providerId));
  if (!connection || connection.credentialRef.type !== "tenant_secret") return undefined;

  const encrypted = connection.credentialRef.encryptedValues[key];
  if (!encrypted) return undefined;

  try {
    return decryptCredentialValue(encrypted);
  } catch {
    // Malformed/wrong-key ciphertext — fail safe (never throw into a
    // provider adapter's request path), same posture as an absent key.
    return undefined;
  }
}

/**
 * Convenience for a provider adapter that needs several keys at once
 * (e.g. WhatsApp's phoneNumberId + accessToken + businessAccountId) —
 * one connection fetch instead of N. A key with no stored value, or
 * one that fails to decrypt, is simply absent from the result (never
 * an `undefined` placeholder) so callers can use plain `in` / spread
 * checks against their own env-derived defaults.
 */
export async function resolveTenantCredentials(organizationId: string, providerId: string, keys: string[]): Promise<Record<string, string>> {
  const repository = await getIntegrationConnectionRepository();
  const connection = await runWithTenantContext({ organizationId }, () => repository.findByProviderId(providerId));
  if (!connection || connection.credentialRef.type !== "tenant_secret") return {};

  const result: Record<string, string> = {};
  for (const key of keys) {
    const encrypted = connection.credentialRef.encryptedValues[key];
    if (!encrypted) continue;
    try {
      result[key] = decryptCredentialValue(encrypted);
    } catch {
      // Omit this key only — let the caller fall back to env for it alone.
    }
  }
  return result;
}
