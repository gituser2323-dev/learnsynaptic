/**
 * Staging-only operator script: complete local staging admin setup using
 * existing auth/onboarding/MFA services — never bypasses the platform MFA gate.
 *
 * Steps:
 *  1. Stamp emailVerifiedAt (same bootstrap pattern as scripts/rc9/seedLoadTestData.ts)
 *  2. createOrganizationForUser if the account has no org
 *  3. Real MFA beginSetup + confirmSetup (TOTP) — writes otpauth URI + recovery
 *     codes to .staging-admin.credentials (gitignored) so the operator can enroll
 *     an authenticator. Does NOT disable or weaken platform MFA enforcement.
 *
 * Usage (staging env only):
 *   npx tsx --env-file=.env.staging.local scripts/staging/complete-staging-admin.ts
 */
import { writeFileSync, readFileSync, existsSync } from "fs";
import { getUserRepository } from "@/lib/db";
import { getConnection } from "@/lib/db/connection";
import { onboardingService } from "@/lib/services/onboarding/onboardingService";
import { mfaService } from "@/lib/services/auth/mfaService";
import { generateTotp } from "@/lib/services/auth/totp";

const CREDENTIALS_PATH = ".staging-admin.credentials";

function readCredentialsEmail(): string {
  if (!existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Missing ${CREDENTIALS_PATH}`);
  }
  const vals: Record<string, string> = {};
  for (const line of readFileSync(CREDENTIALS_PATH, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [k, ...rest] = line.split("=");
    vals[k.trim()] = rest.join("=").trim();
  }
  if (!vals.EMAIL) throw new Error("EMAIL missing from .staging-admin.credentials");
  return vals.EMAIL;
}

function upsertCredentialLines(updates: Record<string, string>): void {
  const existing = existsSync(CREDENTIALS_PATH) ? readFileSync(CREDENTIALS_PATH, "utf8") : "";
  const lines = existing.split("\n");
  const keys = new Set(Object.keys(updates));
  const out: string[] = [];
  for (const line of lines) {
    if (!line.includes("=") || line.startsWith("#")) {
      out.push(line);
      continue;
    }
    const key = line.split("=", 1)[0].trim();
    if (keys.has(key)) {
      out.push(`${key}=${updates[key]}`);
      keys.delete(key);
    } else {
      out.push(line);
    }
  }
  for (const key of keys) {
    out.push(`${key}=${updates[key]}`);
  }
  writeFileSync(CREDENTIALS_PATH, out.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").replace(/\n*$/, "\n"));
}

async function main(): Promise<void> {
  const email = readCredentialsEmail();
  await getConnection();
  const userRepository = await getUserRepository();
  let user = await userRepository.findByEmail(email);
  if (!user) {
    throw new Error(`No user for ${email}. Create via createAdminUser.ts first.`);
  }

  if (!user.emailVerifiedAt) {
    user = await userRepository.update(user.id, { emailVerifiedAt: new Date().toISOString() });
    console.log("emailVerifiedAt: stamped");
  } else {
    console.log("emailVerifiedAt: already set");
  }

  if (!user.organizationId) {
    const orgResult = await onboardingService.createOrganizationForUser(user.id, {
      name: "LearnSynaptic Staging Academy",
      country: "IN",
      industry: "education",
      teamSize: "1-10",
    });
    if (!orgResult.success) {
      throw new Error(`createOrganizationForUser failed: ${JSON.stringify(orgResult.errors)}`);
    }
    user = (await userRepository.findById(user.id))!;
    console.log(`organization: ${orgResult.organization.name} (${orgResult.organization.id}) alreadyExisted=${Boolean(orgResult.alreadyExisted)}`);
  } else {
    console.log(`organization: already bound (${user.organizationId})`);
  }

  if (!user.mfaEnabled) {
    const { secret, otpauthUri } = await mfaService.beginSetup(user.id, user.email);
    const code = generateTotp(secret);
    const confirmed = await mfaService.confirmSetup(user.id, code);
    if (!confirmed.success) {
      throw new Error(`MFA confirmSetup failed: ${confirmed.error}`);
    }
    upsertCredentialLines({
      MFA_OTPATH_URI: otpauthUri,
      MFA_TOTP_SECRET: secret,
      MFA_RECOVERY_CODES: confirmed.recoveryCodes.join(","),
      MFA_NOTE: "Import MFA_OTPATH_URI into Google Authenticator/Authy. Platform APIs require mfaEnabled (now true). Login requires a TOTP or recovery code.",
    });
    console.log("mfaEnabled: true (real TOTP confirmSetup). otpauth + recovery codes written to .staging-admin.credentials");
  } else {
    console.log("mfaEnabled: already true");
  }

  const finalUser = await userRepository.findById(user.id);
  console.log(
    JSON.stringify(
      {
        email: finalUser?.email,
        emailVerified: Boolean(finalUser?.emailVerifiedAt),
        organizationId: finalUser?.organizationId ?? null,
        mfaEnabled: finalUser?.mfaEnabled ?? false,
        platformRole: finalUser?.platformRole ?? null,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
