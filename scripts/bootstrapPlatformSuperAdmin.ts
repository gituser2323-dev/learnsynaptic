import { getUserRepository } from "@/lib/db";
import { getConnection } from "@/lib/db/connection";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";

/**
 * RC-6 — Platform Super Admin & SaaS Operations Console.
 *
 * The ONLY mechanism in this codebase that can ever set
 * `User.platformRole` — there is deliberately no HTTP route, no
 * self-service flow, no "Become Super Admin" button anywhere (the
 * mission's own explicit instruction). This is the same
 * operator-controlled-CLI-script pattern already established by
 * `scripts/createAdminUser.ts`/`resetAdminPassword.ts`: whoever can run
 * this has direct database/deployment access already, which is the
 * correct trust boundary for granting the single most privileged
 * account class in the system — no new credential/secret to protect,
 * reusing the same "you already have production access" trust this
 * deployment's other bootstrap scripts rely on.
 *
 * Deliberately does NOT create a new user account — `authService.createUser()`
 * always attaches a new user to a tenant Organization and checks that
 * org's seat limit (correct for ordinary staff, semantically wrong for
 * a platform operator who isn't a member of any one tenant). The
 * target account must already exist (created normally via
 * `scripts/createAdminUser.ts` first, or any real staff account this
 * operator has chosen to elevate) — this script's only job is granting
 * (or revoking) the platform dimension on top of it.
 *
 * Idempotent: re-running with the same email and no --revoke flag is a
 * safe no-op if the role is already set (confirms, doesn't duplicate
 * anything — there's nothing to duplicate, it's a single field).
 * Auditable: every grant/revoke writes a real AuditLog entry,
 * `actorType: "system"` (a CLI operator, not a web-authenticated user —
 * there is no request/session to attribute this to).
 *
 * Usage:
 *   npx tsx scripts/bootstrapPlatformSuperAdmin.ts <email>            # grant
 *   npx tsx scripts/bootstrapPlatformSuperAdmin.ts <email> --revoke   # revoke
 */
async function main(): Promise<void> {
  const [, , email, flag] = process.argv;
  if (!email) {
    console.error("Usage: npx tsx scripts/bootstrapPlatformSuperAdmin.ts <email> [--revoke]");
    process.exitCode = 1;
    return;
  }
  const revoke = flag === "--revoke";

  await getConnection();
  const userRepository = await getUserRepository();
  const user = await userRepository.findByEmail(email);
  if (!user) {
    console.error(
      `No user with email "${email}" exists. Create the account first (e.g. npx tsx scripts/createAdminUser.ts ` +
        `${email} <password>), then re-run this script to grant platform access.`,
    );
    process.exitCode = 1;
    return;
  }

  if (revoke) {
    if (!user.platformRole) {
      console.log(`"${email}" already has no platform role — nothing to revoke.`);
      return;
    }
    await userRepository.update(user.id, { platformRole: null });
    await auditLogService.record({
      action: AUDIT_ACTIONS.PLATFORM_SUPER_ADMIN_REVOKED,
      entityType: "User",
      entityId: user.id,
      actorType: "system",
      metadata: { email, method: "cli_bootstrap_script" },
    });
    console.log(`Platform super_admin access revoked for "${email}".`);
    return;
  }

  if (user.platformRole === "super_admin") {
    console.log(`"${email}" already has platform super_admin access — nothing to do (idempotent).`);
  } else {
    await userRepository.update(user.id, { platformRole: "super_admin" });
    await auditLogService.record({
      action: AUDIT_ACTIONS.PLATFORM_SUPER_ADMIN_GRANTED,
      entityType: "User",
      entityId: user.id,
      actorType: "system",
      metadata: { email, method: "cli_bootstrap_script" },
    });
    console.log(`Platform super_admin access granted to "${email}".`);
  }

  if (!user.mfaEnabled) {
    console.warn(
      "\nWARNING: this account does not have MFA enabled yet. Every /api/admin/platform/* route " +
        "requires MFA regardless of platformRole (see lib/api/withApiRoute.ts's own " +
        "requiredPlatformRole doc comment) — this account cannot actually use the Platform Console " +
        "until MFA is set up (Settings → Security).",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
