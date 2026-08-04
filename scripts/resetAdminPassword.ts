import { authService } from "@/lib/services/auth";

/**
 * RC-1 — the smallest production-safe fix for "no self-service password
 * recovery exists for admin accounts." There is no forgot-password flow
 * because there is no transactional (server-side) email provider
 * configured anywhere in this app — EmailJS (used everywhere else) only
 * runs in the browser and can't be triggered from a server-side script
 * or route. Building a real self-service flow would mean adding a new
 * email-sending dependency and deciding on its provider, which is a
 * product/infra decision this stabilization pass isn't scoped to make.
 *
 * This mirrors scripts/createAdminUser.ts's existing precedent exactly:
 * an out-of-band operation that requires shell/deploy access to the
 * running environment, not a public endpoint. Only meaningfully durable
 * once MONGODB_URI is configured — against the in-memory dev repository,
 * the change disappears the moment this process exits, same caveat as
 * every other script in this directory.
 *
 * Usage:
 *   npx tsx scripts/resetAdminPassword.ts <email> <newPassword>
 */
async function main(): Promise<void> {
  const [, , email, newPassword] = process.argv;
  if (!email || !newPassword) {
    console.error("Usage: npx tsx scripts/resetAdminPassword.ts <email> <newPassword>");
    process.exitCode = 1;
    return;
  }

  const result = await authService.resetPassword({ email, newPassword });
  if (!result.success) {
    console.error("Failed to reset password:");
    for (const error of result.errors) {
      console.error(`  ${error.field}: ${error.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Password reset:");
  console.log(`  id:    ${result.user.id}`);
  console.log(`  email: ${result.user.email}`);
  console.log(`  role:  ${result.user.role}`);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exitCode = 1;
});
