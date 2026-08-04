import type { AuthValidationError, LoginCredentials, UserRole } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 10;
const ROLES: UserRole[] = ["counsellor", "manager", "admin"];

export type ValidateLoginCredentialsResult =
  | { valid: true; data: LoginCredentials }
  | { valid: false; errors: AuthValidationError[] };

/**
 * Validates a raw, untrusted login request body — the server-side
 * boundary, same role as lib/services/leads/validation.ts's
 * validateCreateLeadInput. Deliberately does not check password
 * strength here (a login attempt isn't the place to reject a
 * previously-accepted password) — that's validateCreateUserInput's job,
 * only ever exercised when an account is created.
 */
export function validateLoginCredentials(input: unknown): ValidateLoginCredentialsResult {
  const errors: AuthValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: [{ field: "root", message: "Request body must be a JSON object." }] };
  }
  const record = input as Record<string, unknown>;

  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  if (!email) errors.push({ field: "email", message: "Email is required." });
  else if (!EMAIL_RE.test(email)) errors.push({ field: "email", message: "Email must be a valid address." });

  const password = typeof record.password === "string" ? record.password : "";
  if (!password) errors.push({ field: "password", message: "Password is required." });

  if (errors.length > 0) return { valid: false, errors };

  // RC-1 — all optional, all read straight through with no further
  // validation here: `rememberMe` only ever affects session TTL (never
  // a security-relevant check itself), `mfaCode`/`trustedDeviceToken`
  // are verified by mfaService against real stored state — a malformed
  // or garbage value for either simply fails that check the normal way,
  // not a 400 at this layer.
  const rememberMe = record.rememberMe === true;
  const mfaCode = typeof record.mfaCode === "string" ? record.mfaCode : undefined;
  const trustedDeviceToken = typeof record.trustedDeviceToken === "string" ? record.trustedDeviceToken : undefined;

  return { valid: true, data: { email, password, rememberMe, mfaCode, trustedDeviceToken } };
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role: UserRole;
  name?: string;
}

export type ValidateCreateUserInputResult =
  | { valid: true; data: CreateUserRequest }
  | { valid: false; errors: AuthValidationError[] };

/**
 * Used by authService.createUser() — called only from
 * scripts/createAdminUser.ts today (no public self-registration
 * endpoint exists; staff accounts are provisioned out-of-band). Kept as
 * a real validator, not inlined, so a future admin-facing "create user"
 * route can reuse it without duplicating these rules.
 */
export function validateCreateUserInput(input: unknown): ValidateCreateUserInputResult {
  const errors: AuthValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: [{ field: "root", message: "Request body must be a JSON object." }] };
  }
  const record = input as Record<string, unknown>;

  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  if (!email) errors.push({ field: "email", message: "Email is required." });
  else if (!EMAIL_RE.test(email)) errors.push({ field: "email", message: "Email must be a valid address." });

  const password = typeof record.password === "string" ? record.password : "";
  if (!password) errors.push({ field: "password", message: "Password is required." });
  else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push({ field: "password", message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
  }

  const role = typeof record.role === "string" ? (record.role as UserRole) : undefined;
  if (!role) errors.push({ field: "role", message: "Role is required." });
  else if (!ROLES.includes(role)) {
    errors.push({ field: "role", message: `Role must be one of: ${ROLES.join(", ")}.` });
  }

  const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : undefined;

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: { email, password, role: role as UserRole, name } };
}

export type ValidatePasswordResetResult =
  | { valid: true; data: { email: string; newPassword: string } }
  | { valid: false; errors: AuthValidationError[] };

/**
 * RC-1 — used by authService.resetPassword(), called only from
 * scripts/resetAdminPassword.ts today (see that file's own doc comment
 * for why this is a CLI script, not a self-service email flow). Same
 * strength rule as account creation — a reset password shouldn't be
 * held to a lower bar than the original.
 */
export function validatePasswordReset(input: unknown): ValidatePasswordResetResult {
  const errors: AuthValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: [{ field: "root", message: "Request body must be a JSON object." }] };
  }
  const record = input as Record<string, unknown>;

  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  if (!email) errors.push({ field: "email", message: "Email is required." });
  else if (!EMAIL_RE.test(email)) errors.push({ field: "email", message: "Email must be a valid address." });

  const newPassword = typeof record.newPassword === "string" ? record.newPassword : "";
  if (!newPassword) errors.push({ field: "newPassword", message: "New password is required." });
  else if (newPassword.length < PASSWORD_MIN_LENGTH) {
    errors.push({ field: "newPassword", message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: { email, newPassword } };
}

// ─── RC-1 — Production Hardening: Authentication & Identity ─────────────

/** Real, minimally configurable password policy — length is the one
 *  requirement enforced everywhere in this app already
 *  (PASSWORD_MIN_LENGTH, shared with account creation/CLI reset above);
 *  the additional character-class checks below are deliberately kept to
 *  a short, well-established set (OWASP's own current guidance
 *  de-emphasizes complexity rules in favor of length + breach-list
 *  checks, but a mixed-case/digit requirement is still a real, common
 *  enterprise-SaaS baseline the mission's own "configurable validation"
 *  line asks for) rather than an exhaustive policy engine this app has
 *  no product requirement for. */
export function validatePasswordStrength(password: string): AuthValidationError[] {
  const errors: AuthValidationError[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push({ field: "password", message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    errors.push({ field: "password", message: "Password must include both uppercase and lowercase letters." });
  }
  if (!/[0-9]/.test(password)) {
    errors.push({ field: "password", message: "Password must include at least one digit." });
  }
  return errors;
}

export type ValidateForgotPasswordResult = { valid: true; data: { email: string } } | { valid: false; errors: AuthValidationError[] };

export function validateForgotPasswordInput(input: unknown): ValidateForgotPasswordResult {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: [{ field: "root", message: "Request body must be a JSON object." }] };
  }
  const record = input as Record<string, unknown>;
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  if (!email || !EMAIL_RE.test(email)) {
    return { valid: false, errors: [{ field: "email", message: "A valid email is required." }] };
  }
  return { valid: true, data: { email } };
}

export type ValidateCompletePasswordResetResult =
  | { valid: true; data: { token: string; newPassword: string } }
  | { valid: false; errors: AuthValidationError[] };

export function validateCompletePasswordResetInput(input: unknown): ValidateCompletePasswordResetResult {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: [{ field: "root", message: "Request body must be a JSON object." }] };
  }
  const record = input as Record<string, unknown>;
  const token = typeof record.token === "string" ? record.token : "";
  if (!token) return { valid: false, errors: [{ field: "token", message: "Reset token is required." }] };

  const newPassword = typeof record.newPassword === "string" ? record.newPassword : "";
  const strengthErrors = validatePasswordStrength(newPassword);
  if (strengthErrors.length > 0) return { valid: false, errors: strengthErrors.map((e) => ({ ...e, field: "newPassword" })) };

  return { valid: true, data: { token, newPassword } };
}

export type ValidateChangePasswordResult =
  | { valid: true; data: { currentPassword: string; newPassword: string } }
  | { valid: false; errors: AuthValidationError[] };

export function validateChangePasswordInput(input: unknown): ValidateChangePasswordResult {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: [{ field: "root", message: "Request body must be a JSON object." }] };
  }
  const record = input as Record<string, unknown>;
  const currentPassword = typeof record.currentPassword === "string" ? record.currentPassword : "";
  if (!currentPassword) return { valid: false, errors: [{ field: "currentPassword", message: "Current password is required." }] };

  const newPassword = typeof record.newPassword === "string" ? record.newPassword : "";
  const strengthErrors = validatePasswordStrength(newPassword);
  if (strengthErrors.length > 0) return { valid: false, errors: strengthErrors.map((e) => ({ ...e, field: "newPassword" })) };

  return { valid: true, data: { currentPassword, newPassword } };
}
