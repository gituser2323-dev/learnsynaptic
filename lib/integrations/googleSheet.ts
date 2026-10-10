export interface SheetRegistrationRow {
  name: string;
  phone: string;
  program: string;
  source: string;
}

export type SheetAppendResult = { recorded: true } | { recorded: false; reason: "not_configured" | "failed" };

/**
 * Appends one registration to a Google Sheet through an Apps Script web app
 * (see docs/google-sheet-registrations.md). The URL and shared secret live in
 * server-only env vars, never in the browser bundle.
 */
export async function appendRegistrationToSheet(row: SheetRegistrationRow): Promise<SheetAppendResult> {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!url) return { recorded: false, reason: "not_configured" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: process.env.GOOGLE_SHEET_WEBHOOK_SECRET ?? "",
        submittedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        ...row,
      }),
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok) {
      console.error("[googleSheet] webhook responded", res.status);
      return { recorded: false, reason: "failed" };
    }
    return { recorded: true };
  } catch (err) {
    console.error("[googleSheet] webhook request failed:", err);
    return { recorded: false, reason: "failed" };
  }
}
