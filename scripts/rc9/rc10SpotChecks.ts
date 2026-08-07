import { Client } from "./pentestClient";

async function main() {
  // Tenant isolation: Org A admin trying to read an Org B lead by id.
  const orgA = new Client("rc10-spot-tenant", "203.0.113.243");
  await orgA.login("rc9-org-a-admin@learnsynaptic.internal", "RC9-Load-Test-Pass-1");
  const orgB = new Client("rc10-spot-tenant-b", "203.0.113.244");
  await orgB.login("rc9-org-b-admin@learnsynaptic.internal", "RC9-Load-Test-Pass-1");
  const orgBLeads = await orgB.req("GET", "/api/admin/leads?limit=1");
  const orgBLeadId = (orgBLeads.body?.items ?? [])[0]?.id;
  const crossRead = await orgA.req("GET", `/api/admin/leads/${orgBLeadId}`);
  console.log(`[TENANT] Org A reading Org B's real lead id -> status=${crossRead.status} (expect 404)`);

  // Auth: unauthenticated request to a protected admin route.
  const noAuth = await fetch("http://localhost:3000/api/admin/leads", { headers: { origin: "http://localhost:3000" } });
  console.log(`[AUTH] Unauthenticated GET /api/admin/leads -> status=${noAuth.status} (expect 401)`);

  // Platform authorization: ordinary tenant admin hitting a platform route.
  const platformAttempt = await orgA.req("GET", "/api/admin/platform/organizations");
  console.log(`[PLATFORM] Tenant admin GET /api/admin/platform/organizations -> status=${platformAttempt.status} (expect 403)`);

  // RBAC: counsellor hitting a manager-tier route.
  const counsellor = new Client("rc10-spot-rbac", "203.0.113.245");
  await counsellor.login("rc9-org-a-counsellor@learnsynaptic.internal", "RC9-Load-Test-Pass-1");
  const rbacAttempt = await counsellor.req("GET", "/api/admin/crm/pipelines");
  console.log(`[RBAC] Counsellor GET /api/admin/crm/pipelines -> status=${rbacAttempt.status} (expect 403)`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
