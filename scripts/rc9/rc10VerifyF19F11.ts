import { Client } from "./pentestClient";

type NamedUser = { name?: string };
type WorkflowDef = { active?: boolean; triggerEventType?: string };

async function verifyF19() {
  const admin = new Client("rc10-verify-f19", "203.0.113.240");
  const login = await admin.login("rc9-org-a-admin@learnsynaptic.internal", "RC9-Load-Test-Pass-1");
  if (login.status !== 200) throw new Error("F19 verify login failed " + login.status);
  const res = await admin.req("GET", "/api/admin/users");
  const users = (res.body?.users ?? []) as NamedUser[];
  console.log(`[F-19] GET /api/admin/users -> status=${res.status} count=${users.length}`);
  console.log(users.map((u) => u.name));
  const leak = users.some((u) => u.name?.includes("Organization B") || u.name?.includes("Organization C"));
  console.log(`[F-19] CROSS-TENANT LEAK STILL PRESENT: ${leak ? "YES - REGRESSION" : "NO - confirmed fixed"}`);
}

async function verifyF11() {
  const admin = new Client("rc10-verify-f11", "203.0.113.241");
  const login = await admin.login("rc9-org-a-admin@learnsynaptic.internal", "RC9-Load-Test-Pass-1");
  if (login.status !== 200) throw new Error("F11 verify login failed " + login.status);

  // Confirm Org A's own active workflow definition still exists.
  const defs = await admin.req("GET", "/api/admin/automation/workflows");
  const list = (defs.body?.items ?? defs.body?.workflows ?? []) as WorkflowDef[];
  const activeDefs = list.filter((d) => d.active && d.triggerEventType === "lead.created");
  console.log(`[F-11] Org A active lead.created workflow definitions: ${activeDefs.length}`);

  // Create a fresh public lead (no tenant context) via the real public endpoint.
  const createRes = await fetch("http://localhost:3000/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": "203.0.113.242" },
    body: JSON.stringify({ name: "RC10 Verify Public Lead", email: `rc10-verify-${Date.now()}@example.com`, phone: "+919800099001", source: "rc10-verify" }),
  });
  const createBody = await createRes.json();
  const leadId = createBody?.lead?.id ?? createBody?.id;
  console.log(`[F-11] Created public lead: status=${createRes.status} id=${leadId}`);
}

async function main() {
  await verifyF19();
  await verifyF11();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
