import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * RC-8 — Documentation, API Documentation & Operational Knowledge
 * Base. Regenerates docs/api/openapi.json (and the data
 * docs/api/inventory.md's own table is derived from) directly from
 * every real `withApiRoute("routeName", handler, {...})` registration
 * across app/api/**\/route.ts — 225 operations across 188 files as of
 * RC-8. Deliberately mechanical, not hand-maintained: this is a
 * regex-based structural extraction of the actual source, not a
 * second, driftable description of the API written from memory. Run
 * this after adding/removing/changing a route's `withApiRoute()`
 * options (role, capability, rate limit) — nothing else keeps
 * docs/api/openapi.json in sync automatically.
 *
 * Usage: `npx tsx scripts/docs/generateOpenApiSpec.ts`
 *
 * Request/response bodies are intentionally generic
 * (`{type: "object"}` + an `x-source-file` pointer) rather than
 * fabricated per-route schemas — this codebase validates request
 * bodies with hand-rolled per-service validator functions
 * (lib/services/*\/validation.ts), not a schema library, so there is
 * no single source this script could mechanically derive an exact
 * body shape from without risking inventing one. See this project's
 * own "Do NOT invent APIs" standard (RC-8 mission, Core Rule).
 */

interface RouteRow {
  method: string;
  path: string;
  routeName: string;
  requiredRole: string | null;
  requiredCapability: string | null;
  requiredPlatformRole: string | null;
  rateLimit: string | null;
  file: string;
}

const REPO_ROOT = path.resolve(__dirname, "../..");

/**
 * `fs.globSync` exists at runtime on this project's own required Node
 * version (>=22, per package.json's `engines`) but isn't declared by
 * `@types/node@^20`, this repo's pinned major version — rather than
 * bump a shared devDependency for one script, a small manual recursive
 * walk avoids the extra type dependency entirely.
 */
function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(full));
    } else if (entry.isFile() && entry.name === "route.ts") {
      results.push(path.relative(REPO_ROOT, full));
    }
  }
  return results;
}

function extractRoutes(): RouteRow[] {
  const routeFiles = findRouteFiles(path.join(REPO_ROOT, "app/api"));
  const routes: RouteRow[] = [];

  for (const relFile of routeFiles) {
    const file = path.join(REPO_ROOT, relFile);
    const src = readFileSync(file, "utf-8");
    const urlPath = "/" + path.dirname(relFile).slice("app/".length);

    const methodRe = /export const (GET|POST|PUT|PATCH|DELETE)\s*=\s*withApiRoute\(\s*"([^"]+)"\s*,\s*\w+\s*,\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = methodRe.exec(src))) {
      const [, method, routeName] = m;
      const tail = src.slice(m.index + m[0].length, m.index + m[0].length + 800);
      const end = tail.indexOf("});");
      const optsBlock = end !== -1 ? tail.slice(0, end) : tail.slice(0, 400);

      const requiredRole = optsBlock.match(/requiredRole:\s*"([^"]+)"/)?.[1] ?? null;
      const requiredCapability = optsBlock.match(/requiredCapability:\s*"([^"]+)"/)?.[1] ?? null;
      const requiredPlatformRole = optsBlock.match(/requiredPlatformRole:\s*"([^"]+)"/)?.[1] ?? null;
      const rateLimitMatch = optsBlock.match(/rateLimit:\s*\{\s*limit:\s*(\d+),\s*windowMs:\s*([^}]+)\}/);
      const rateLimit = rateLimitMatch ? `${rateLimitMatch[1]}/${rateLimitMatch[2].trim()}` : null;

      routes.push({ method, path: urlPath, routeName, requiredRole, requiredCapability, requiredPlatformRole, rateLimit, file: relFile });
    }

    // Flag any exported HTTP method NOT wrapped in withApiRoute — a
    // deliberate escape hatch this app has exactly one real, documented
    // use of (app/api/files/local/[...key]/route.ts's signed-URL
    // delivery route) — never silently skipped, always surfaced so a
    // future unwrapped route is a visible decision, not an omission.
    const exportedRe = /export (?:async function|const) (GET|POST|PUT|PATCH|DELETE)\b/g;
    let em: RegExpExecArray | null;
    while ((em = exportedRe.exec(src))) {
      const method = em[1];
      if (!routes.some((r) => r.method === method && r.file === relFile)) {
        routes.push({ method, path: urlPath, routeName: "NO_WITHAPIROUTE_WRAPPER", requiredRole: null, requiredCapability: null, requiredPlatformRole: null, rateLimit: null, file: relFile });
      }
    }
  }

  return routes.sort((a, b) => (a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path)));
}

function humanize(routeName: string, method: string): string {
  const parts = routeName.split(".");
  const verbMap: Record<string, string> = { list: "List", get: "Get", create: "Create", update: "Update", delete: "Delete", remove: "Delete" };
  const last = parts[parts.length - 1];
  const verb = verbMap[last];
  const subjectParts = verb ? parts.slice(1, -1) : parts.slice(1);
  let subject = subjectParts.map((p) => p.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()).join(" ");
  if (!subject) subject = parts.slice(1).join(" ");
  return verb ? `${verb} ${subject}`.trim() : `${method} ${parts.slice(1).join(" ")}`.replace(/\./g, " ");
}

function domainTag(routePath: string): string {
  if (/^\/api\/admin\/platform/.test(routePath)) return "Platform Admin";
  const adminMatch = routePath.match(/^\/api\/admin\/([a-z-]+)/);
  if (adminMatch) return adminMatch[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const otherMatch = routePath.match(/^\/api\/(auth|onboarding|webhooks|health|cron)/);
  if (otherMatch) return otherMatch[1].charAt(0).toUpperCase() + otherMatch[1].slice(1);
  return "Public";
}

function toOpenApiPath(routePath: string): string {
  return routePath.replace(/\[\.\.\.([a-zA-Z]+)\]/g, "{$1}").replace(/\[([a-zA-Z]+)\]/g, "{$1}");
}

function buildSpec(routes: RouteRow[]) {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const r of routes) {
    if (r.routeName === "NO_WITHAPIROUTE_WRAPPER") continue; // documented separately, not a real gap to hide
    const oaPath = toOpenApiPath(r.path);
    paths[oaPath] ??= {};
    const method = r.method.toLowerCase();

    let security: unknown[];
    if (r.requiredPlatformRole) security = [{ cookieAuth: [] }];
    else if (r.path.includes("/cron/")) security = [{ cronSecret: [] }];
    else if (r.requiredRole) security = [{ cookieAuth: [] }];
    else if (r.routeName.startsWith("auth.") || r.routeName.startsWith("onboarding.")) security = [{ cookieAuth: [] }, {}];
    else security = [];

    const params = [...oaPath.matchAll(/\{([a-zA-Z]+)\}/g)].map((mm) => ({ name: mm[1], in: "path", required: true, schema: { type: "string" } }));

    const responses: Record<string, unknown> = {
      "200": { description: "Success", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { type: "object" } } } } } },
    };
    if (r.requiredRole || r.requiredPlatformRole) {
      responses["401"] = { description: "Not authenticated" };
      responses["403"] = { description: "Insufficient role/permission, or plan does not include this capability" };
    }
    responses["400"] = { description: "Validation failed" };
    if (r.rateLimit) responses["429"] = { description: `Rate limit exceeded (${r.rateLimit} requests)` };
    responses["500"] = { description: "Unexpected server error" };

    const op: Record<string, unknown> = {
      operationId: r.routeName,
      summary: humanize(r.routeName, r.method),
      tags: [domainTag(r.path)],
      security,
      parameters: params,
      responses,
      "x-source-file": r.file,
    };
    if (r.requiredRole) op["x-required-role"] = r.requiredRole;
    if (r.requiredPlatformRole) op["x-required-platform-role"] = r.requiredPlatformRole;
    if (r.requiredCapability) op["x-required-plan-capability"] = r.requiredCapability;
    if (r.rateLimit) op["x-rate-limit"] = r.rateLimit;

    if (["post", "put", "patch"].includes(method)) {
      op.requestBody = {
        required: false,
        content: { "application/json": { schema: { type: "object", description: "See x-source-file for the exact request validator/shape — hand-rolled per-service validators, not a schema library." } } },
      };
    }

    paths[oaPath][method] = op;
  }

  const tags = Array.from(new Set(Object.values(paths).flatMap((p) => Object.values(p).map((op) => (op as { tags: string[] }).tags[0])))).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );

  return {
    openapi: "3.1.0",
    info: {
      title: "LearnSynaptic Business OS API",
      version: "RC-7",
      description:
        "Authoritative, mechanically-generated inventory of every real HTTP route in this repository (app/api/**/route.ts). Generated from the actual withApiRoute() registrations, not hand-maintained and not aspirational. Request/response bodies point at their real source file rather than a duplicated, driftable schema. See docs/api/inventory.md for the human-readable version and docs/api/security.md for the security model.",
    },
    servers: [{ url: "/", description: "Same-origin, relative to the deployed app root (paths already include the /api prefix)" }],
    tags: tags.map((name) => ({ name })),
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "ls_access_token",
          description: "httpOnly JWT access-token cookie, set by POST /api/auth/login or /api/auth/refresh. Verified by middleware.ts at the Edge before the route handler ever runs.",
        },
        cronSecret: {
          type: "http",
          scheme: "bearer",
          description: "CRON_SECRET bearer token, used exclusively by /api/cron/run-due-jobs (Vercel Cron). Never a browser session.",
        },
      },
    },
    paths: Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b))),
  };
}

function main(): void {
  const routes = extractRoutes();
  const unwrapped = routes.filter((r) => r.routeName === "NO_WITHAPIROUTE_WRAPPER");
  const spec = buildSpec(routes);
  const outPath = path.join(REPO_ROOT, "docs/api/openapi.json");
  writeFileSync(outPath, JSON.stringify(spec, null, 2) + "\n");

  const opCount = Object.values(spec.paths).reduce((n, p) => n + Object.keys(p as object).length, 0);
  console.log(`Wrote ${outPath}`);
  console.log(`Paths: ${Object.keys(spec.paths).length}, Operations: ${opCount}, Tags: ${spec.tags.length}`);
  if (unwrapped.length > 0) {
    console.log(`\nRoutes NOT wrapped in withApiRoute() (excluded from the spec, review manually):`);
    for (const r of unwrapped) console.log(`  ${r.method} ${r.path} (${r.file})`);
  }
}

main();
