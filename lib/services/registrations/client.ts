import type { CreateRegistrationInput, CreateRegistrationResult } from "./types";

/**
 * Browser-side helper for POST /api/registrations — mirrors
 * lib/services/leads/client.ts exactly (same reasoning: keep the
 * server-only registrationService/registry out of the client bundle).
 * RC-1: previously nothing in the client code called this at all.
 */
export async function submitRegistration(input: CreateRegistrationInput): Promise<CreateRegistrationResult> {
  const response = await fetch("/api/registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return (await response.json()) as CreateRegistrationResult;
}
