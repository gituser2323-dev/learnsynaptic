import { Client, type JsonResponseBody } from "./pentestClient";

/**
 * RC-9 §27-29 — API performance benchmarking (p50/p95/p99 on
 * representative endpoints), DB query audit (informed by results, not
 * guessed), and pagination correctness — all against the REAL seeded
 * RC-9 dataset (3 orgs, ~120 leads/60 tasks/124 activities/24
 * opportunities each). No invented universal latency targets — this
 * records what the environment actually does.
 *
 * Environment: local dev (Next.js Turbopack dev server, not `next
 * build`), MongoDB replSet on localhost:27117, single process, no
 * concurrent production traffic. Numbers here characterize relative
 * cost and regressions, not absolute production SLAs.
 *
 * Usage: npx tsx scripts/rc9/perfAndPagination.ts
 */

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function bench(label: string, fn: () => Promise<number>, iterations = 20): Promise<void> {
  const timings: number[] = [];
  let firstStatus = 0;
  for (let i = 0; i < iterations; i++) {
    const t0 = Date.now();
    firstStatus = await fn();
    timings.push(Date.now() - t0);
  }
  const sorted = [...timings].sort((a, b) => a - b);
  console.log(
    `${label.padEnd(48)} n=${iterations} lastStatus=${firstStatus} p50=${percentile(sorted, 50)}ms p95=${percentile(sorted, 95)}ms p99=${percentile(sorted, 99)}ms max=${sorted[sorted.length - 1]}ms`,
  );
}

/** RC-9 — rate limiting (F-01's own fix) is real and per-route/per-IP
 *  (routeName:IP). Hammering 20+ iterations against the SAME route from
 *  ONE IP inside one benchmark run legitimately exhausts that route's
 *  own limit partway through (e.g. admin.leads.list: 60/min, shared
 *  across every leads-route variant benchmarked below) — a correct
 *  rate-limiter doing its job, not a performance bug. Each logical
 *  benchmark below therefore gets its own dedicated Client/IP so a
 *  30-request-per-route budget never collides with a sibling benchmark's
 *  own budget, the same isolation pattern used for AUTH-16/17 earlier
 *  in this pass. */
async function loggedInClient(label: string, ip: string): Promise<Client> {
  const c = new Client(label, ip);
  const res = await c.login("rc9-org-a-admin@learnsynaptic.internal", "RC9-Load-Test-Pass-1");
  if (res.status !== 200) throw new Error(`login failed for ${label}: ${res.status}`);
  return c;
}

async function main(): Promise<void> {
  console.log("=== RC-9 API Performance Benchmark (representative endpoints, real seeded data) ===\n");

  const c1 = await loggedInClient("perf-leads-default", "203.0.113.201");
  await bench("GET /api/admin/leads (default page, 20/page)", async () => {
    const r = await c1.req("GET", "/api/admin/leads?limit=20");
    return r.status;
  });

  const c2 = await loggedInClient("perf-leads-100", "203.0.113.202");
  await bench("GET /api/admin/leads?limit=100", async () => {
    const r = await c2.req("GET", "/api/admin/leads?limit=100");
    return r.status;
  });

  const c3 = await loggedInClient("perf-leads-search", "203.0.113.203");
  await bench("GET /api/admin/leads?search=... (text search)", async () => {
    const r = await c3.req("GET", "/api/admin/leads?search=lead&limit=20");
    return r.status;
  });

  const c4 = await loggedInClient("perf-leads-filtered", "203.0.113.204");
  await bench("GET /api/admin/leads?status=... (filtered)", async () => {
    const r = await c4.req("GET", "/api/admin/leads?status=new&limit=20");
    return r.status;
  });

  const c5 = await loggedInClient("perf-tasks", "203.0.113.205");
  await bench("GET /api/admin/crm/tasks", async () => {
    const r = await c5.req("GET", "/api/admin/crm/tasks?limit=20");
    return r.status;
  });

  // activities is a per-entity scoped list by design (entityType +
  // entityId both required — see route's own ValidationApiError), not a
  // global list — resolve one real seeded lead first, then benchmark
  // fetching ITS activity timeline, the actual real-world access shape.
  const c6 = await loggedInClient("perf-activities", "203.0.113.206");
  const sampleLead = await c6.req("GET", "/api/admin/leads?limit=1");
  const sampleLeadId = (sampleLead.body?.items ?? sampleLead.body?.leads ?? [])[0]?.id;
  await bench("GET /api/admin/crm/activities?entityType=Lead&entityId=... (per-entity)", async () => {
    const r = await c6.req("GET", `/api/admin/crm/activities?entityType=Lead&entityId=${sampleLeadId}&limit=20`);
    return r.status;
  });

  const c7 = await loggedInClient("perf-opportunities", "203.0.113.207");
  await bench("GET /api/admin/crm/opportunities", async () => {
    const r = await c7.req("GET", "/api/admin/crm/opportunities?limit=20");
    return r.status;
  });

  const c8 = await loggedInClient("perf-pipeline-analytics", "203.0.113.208");
  await bench("GET /api/admin/crm/pipeline-analytics", async () => {
    const r = await c8.req("GET", "/api/admin/crm/pipeline-analytics");
    return r.status;
  }, 15);

  const c9 = await loggedInClient("perf-csv-export", "203.0.113.209");
  await bench("GET /api/admin/leads (CSV export, 5000 cap)", async () => {
    const r = await c9.req("GET", "/api/admin/leads?format=csv");
    return r.status;
  }, 5);

  console.log("\n=== Pagination correctness (real seeded leads, ~120 for this org) ===\n");

  const admin = await loggedInClient("perf-pagination", "203.0.113.210");
  const page1 = await admin.req("GET", "/api/admin/leads?page=1&limit=20");
  const totalCount = page1.body?.total ?? page1.body?.pagination?.total ?? page1.body?.totalCount;
  const items1 = page1.body?.items ?? page1.body?.leads ?? [];
  console.log(`Page 1: status=${page1.status} items=${items1.length} reportedTotal=${totalCount}`);

  const lastPage = Math.max(1, Math.ceil((totalCount ?? items1.length) / 20));
  const midPage = Math.max(1, Math.floor(lastPage / 2));

  const pageMid = await admin.req("GET", `/api/admin/leads?page=${midPage}&limit=20`);
  const itemsMid = pageMid.body?.items ?? pageMid.body?.leads ?? [];
  console.log(`Page ${midPage} (middle): status=${pageMid.status} items=${itemsMid.length}`);

  const pageLast = await admin.req("GET", `/api/admin/leads?page=${lastPage}&limit=20`);
  const itemsLast = pageLast.body?.items ?? pageLast.body?.leads ?? [];
  console.log(`Page ${lastPage} (last): status=${pageLast.status} items=${itemsLast.length}`);

  const pageBeyond = await admin.req("GET", `/api/admin/leads?page=${lastPage + 5}&limit=20`);
  const itemsBeyond = pageBeyond.body?.items ?? pageBeyond.body?.leads ?? [];
  console.log(`Page ${lastPage + 5} (beyond end): status=${pageBeyond.status} items=${itemsBeyond.length} (expect 0, not error)`);

  // Walk every page, collecting ids, checking for duplicates/gaps against reportedTotal.
  const seenIds = new Set<string>();
  let duplicateCount = 0;
  for (let p = 1; p <= lastPage; p++) {
    const res = await admin.req("GET", `/api/admin/leads?page=${p}&limit=20`);
    const items = res.body?.items ?? res.body?.leads ?? [];
    for (const item of items) {
      if (seenIds.has(item.id)) duplicateCount++;
      seenIds.add(item.id);
    }
  }
  console.log(`\nWalked all ${lastPage} pages: uniqueIdsSeen=${seenIds.size} reportedTotal=${totalCount} duplicatesAcrossPages=${duplicateCount}`);
  console.log(`Consistency: ${seenIds.size === totalCount && duplicateCount === 0 ? "PASS — no duplicates, no missing records" : "MISMATCH — needs investigation"}`);

  // Sorting stability check: same query twice, same page, results should be in identical order.
  const sortA = await admin.req("GET", "/api/admin/leads?page=1&limit=20");
  const sortB = await admin.req("GET", "/api/admin/leads?page=1&limit=20");
  const idsA = (sortA.body?.items ?? sortA.body?.leads ?? []).map((i: JsonResponseBody) => i.id);
  const idsB = (sortB.body?.items ?? sortB.body?.leads ?? []).map((i: JsonResponseBody) => i.id);
  const stableOrder = JSON.stringify(idsA) === JSON.stringify(idsB);
  console.log(`Sort stability (same query, repeated): ${stableOrder ? "PASS — deterministic order" : "FAIL — order differs between identical requests"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
