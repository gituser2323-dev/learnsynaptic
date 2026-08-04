import type { CreateLeadInput, CreateLeadResult } from "./types";

/**
 * Browser-side helper for POST /api/leads. Deliberately separate from
 * leadService.ts / registry.ts (server-only — the registry dynamically
 * imports Mongoose) so a client component importing this file can never
 * accidentally pull server-only code into the browser bundle. This file
 * does one thing: fetch().
 */
export async function submitLead(input: CreateLeadInput): Promise<CreateLeadResult> {
  const response = await fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return (await response.json()) as CreateLeadResult;
}
