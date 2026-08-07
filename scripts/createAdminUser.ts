import { authService } from "@/lib/services/auth";

/**
 * CLI bootstrap for a staff account, bypassing email verification.
 *
 * RC-7 added real public self-service registration (`/admin/register`,
 * `authService.registerUser()`) as the normal way a NEW organization's
 * first user signs up — this script predates that and is no longer the
 * only way in. It stays useful for what self-registration doesn't
 * cover: seeding a test/dev account without going through email
 * verification, or creating an additional user directly inside an
 * *existing* organization from a shell (self-registration always
 * creates a brand-new, org-less account — see authService.registerUser()'s
 * own doc comment — the normal way to add a user to an existing
 * organization is a team invitation, not this script or
 * self-registration). Only meaningfully durable once MONGODB_URI is
 * configured — against the in-memory dev repository, the created user
 * disappears the moment this process exits.
 *
 * Usage:
 *   npx tsx scripts/createAdminUser.ts <email> <password> [role] [name]
 *   role defaults to "admin"; must be one of counsellor/manager/admin.
 */
async function main(): Promise<void> {
  const [, , email, password, roleArg, ...nameParts] = process.argv;
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/createAdminUser.ts <email> <password> [role] [name]");
    process.exitCode = 1;
    return;
  }

  const role = roleArg || "admin";
  const name = nameParts.join(" ") || undefined;

  const result = await authService.createUser({ email, password, role, name });
  if (!result.success) {
    console.error("Failed to create user:");
    for (const error of result.errors) {
      console.error(`  ${error.field}: ${error.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("User created:");
  console.log(`  id:    ${result.user.id}`);
  console.log(`  email: ${result.user.email}`);
  console.log(`  role:  ${result.user.role}`);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exitCode = 1;
});
