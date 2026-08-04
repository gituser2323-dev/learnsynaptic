import { authService } from "@/lib/services/auth";

/**
 * One-time bootstrap for the first staff account (usually "admin") —
 * there is no public self-registration endpoint by design; see
 * authService.createUser()'s doc comment. Only meaningfully durable once
 * MONGODB_URI is configured — against the in-memory dev repository, the
 * created user disappears the moment this process exits.
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
