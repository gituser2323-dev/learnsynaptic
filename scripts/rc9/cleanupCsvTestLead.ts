import { Client, type JsonResponseBody } from "./pentestClient";

async function main() {
  const admin = new Client("cleanup", "203.0.113.220");
  const login = await admin.login("rc9-org-a-admin@learnsynaptic.internal", "RC9-Load-Test-Pass-1");
  if (login.status !== 200) throw new Error("login failed " + login.status);

  const res = await admin.req("GET", "/api/admin/leads?search=cmd&limit=5");
  const items = res.body?.items ?? [];
  console.log(items.map((i: JsonResponseBody) => ({ id: i.id, name: i.name })));

  for (const item of items) {
    if (item.name?.includes("cmd")) {
      const patch = await admin.req("PATCH", `/api/admin/leads/${item.id}`, { body: { name: "Riya Sharma" } });
      console.log(`Renamed ${item.id}: ${patch.status}`);
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
