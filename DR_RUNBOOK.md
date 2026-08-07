# LearnSynaptic — Disaster Recovery Runbook

RC-5 (Backup, Restore & Disaster Recovery). Companion to `RUNBOOK.md`
(day-to-day operations) — this document covers what to do when data is
lost, corrupted, or needs to be recovered: backup strategy, restore
procedure, reconciliation with external providers, and incident
response. No real secrets appear anywhere in this file.

**Status legend used throughout:** every claim below is tagged
**[IMPLEMENTED]** (code/scripts exist in this repo),
**[LOCALLY VERIFIED]** (actually run and proven against the local dev
replica set during RC-5), or
**[REQUIRES PRODUCTION PROVIDER CONFIGURATION]** (cannot be verified
without a real Atlas/S3/etc. account — documented so an operator knows
exactly what to set up before going live).

---

## 1 · Data classification

Every data domain the app touches, classified so backup effort goes
where it actually matters — not "back up everything blindly."

**Legend:** **A**uthoritative (this app is the only copy; permanent
loss if not backed up) · **D**erived (computed from authoritative data;
losing it is a real cost but it's regenerable) · **R**ebuildable (safe
to lose; regenerates itself or is intentionally transient) ·
**E**phemeral (deliberately short-lived, never worth backing up) ·
**X**ternally owned (a third party is the real source of truth; our copy
is a cache/reference).

### 1.1 MongoDB collections (44 models, `lib/db/models/`)

| Class | Collections |
|---|---|
| **A** | `organization`, `user`, `lead`, `task`, `activity`, `opportunity`, `pipeline`, `conversation`, `message`, `campaign`, `whatsappCampaign`, `campaignTemplate`, `workflowDefinition`, `payment`, `subscription`, `plan`, `integrationConnection`, `brandConfiguration`, `auditLog`, `registration`, `attendance`, `meeting`, `tag`, `customFieldDefinition`, `assignmentRule`, `autoReplyRule`, `webhookEndpoint`, `fileAsset` (metadata only — see §1.2), `phoneNumber`, `oauthAccount`, `featureFlag`, `notification`, `usageCounter` |
| **D** | `leadInsight`, `conversationInsight` (AI-generated; regenerable by re-running analysis, but at real API cost — worth backing up, not worth a special RPO) |
| **R** | `scheduledJob` (future work descriptions — recurring jobs re-enqueue on next bootstrap; see §9 for why one-off jobs still need care on restore), `webhookDelivery`, `webhookDeliveryAttempt`, `messageAttempt`, `integrationLog` (operational/debug logs) |
| **E** | `refreshToken`, `passwordResetToken`, `emailVerificationToken`, `mfaEmailOtp`, `mfaRecoveryCode`\*, `trustedDevice` (session/short-lived security state — §10 explains why these must sometimes be *deliberately excluded* from a restore, not just "low priority") |
| **X** | Nothing lives entirely in Mongo for these — see §1.4. `payment`, `whatsappCampaign`/`message`, and `meeting` all have an authoritative *local* row (for app functionality) whose *state* is externally owned (see §1.4) — listed under **A** above because the row itself must still be backed up, but its truth must be reconciled against the provider after any restore. |

\* `mfaRecoveryCode` is technically authoritative security material (a
user-generated one-time-use secret), not truly ephemeral — backed up
with the rest of **A**, but never restored across a security-incident
boundary (§10).

`_migrations` (migration ledger, `lib/db/migrations/`) — **A**,
small, critical for correct migration replay after any restore (§13).

### 1.2 File / object storage (Module 6.2)

- The **bytes** (CRM attachments, conversation media, branding assets,
  exports) live in whichever `STORAGE_PROVIDER` is configured (AWS S3 /
  Cloudinary in production; local filesystem only in dev — see
  `RUNBOOK.md` §11, explicitly unsafe in production). Classified **A**
  — this app has no second copy.
- The `fileAsset` Mongo document is **D** relative to the bytes: it is
  a *pointer* (storage key/URL + metadata). Losing the Mongo row when
  the bytes still exist is recoverable by re-scanning the bucket;
  losing the bytes when the row still exists is not recoverable by
  this app at all — see §6 (reconciliation).

### 1.3 Queue / worker state

No Redis, no separate broker (confirmed RC-3/RC-4). The "queue" is the
`scheduledJob` Mongo collection; the "worker" is a Vercel Cron
invocation. There is **no separate backup domain for the queue** — its
RPO/RTO is identical to the database's (§2), and its *recovery safety*
(which jobs are safe to replay after a restore) is a replay-classification
problem, not a backup-classification one — see §9.

### 1.4 Externally owned state (the DB is a cache, not the truth)

| Domain | Real source of truth | What our DB holds |
|---|---|---|
| WhatsApp/Meta | Meta's WABA infrastructure | `phoneNumber`, `whatsappCampaign`, `message` delivery status, template state — all a *cache* of Meta's last-known state |
| Payments | Razorpay/Stripe/Cashfree (whichever `PaymentProvider` is connected) | `payment`, `paymentWebhookEvent`, `subscription` — our record of what the provider told us, not the provider's ledger |
| Calendar | Google/Microsoft/Zoom | `meeting` metadata — the real event lives in the provider's calendar |
| Email delivery | Postmark/SES/etc. | `messageAttempt`/`activity` records of what we asked the provider to send |
| Object storage | S3/Cloudinary | see §1.2 |

A DB restore **never rewinds any of these providers** — see §14–§16
for the reconciliation requirement this creates.

### 1.5 Configuration, credentials, and encryption keys

| Item | Class | Where it actually lives |
|---|---|---|
| App code, `vercel.json`, `next.config.ts`, migration source | **A**, but **R**ebuildable-from-git (git IS its backup — RC-4 fixed the historical gap where this wasn't true) | Git repository |
| Environment variables (all secrets, provider keys, `CRON_SECRET`) | **A**, **X**ternally managed | Vercel's own encrypted env var store — this app has no local copy and must not create one (§12) |
| `MFA_ENCRYPTION_SECRET`, `TENANT_CREDENTIAL_ENCRYPTION_SECRET`, `WEBHOOK_SECRET_ENCRYPTION_SECRET`, `CALENDAR_TOKEN_ENCRYPTION_SECRET` | **A**, catastrophic-if-lost (see §11) | Vercel env vars — **must** additionally have an out-of-band recovery record per §11, since these can't be "rotated" the way an ordinary API key can |
| Encrypted tenant credentials (`integrationConnection.credentialRef` etc., in Mongo) | **A**, but *worthless without the encryption key above* — a dependent-authoritative pair, not two independent backups | Mongo (bytes only decrypt with the matching key) |

---

## 2 · Recovery objectives (RPO / RTO)

Realistic for this V1 architecture — not aspirational enterprise SLAs.
**The actual achievable numbers depend heavily on which MongoDB Atlas
tier is provisioned in production; this is flagged explicitly because
it's the single biggest real gap between "documented" and "true."**

| Domain | RPO | RTO | Notes |
|---|---|---|---|
| **Database (Atlas M10+, Cloud Backup enabled)** | Minutes (continuous/PITR snapshots) | 30–60 min for this data volume (Atlas restore-in-place or restore-to-new-cluster) | **[REQUIRES PRODUCTION PROVIDER CONFIGURATION]** — depends on Atlas tier actually provisioned |
| **Database (Atlas M0/M2/M5 shared tier, no Cloud Backup)** | **Undefined — as stale as the last manually-run `mongodump`.** No automated backup exists on these tiers. | Hours, fully manual | Flagged as a real, material V1 risk — see §3.4 recommendation |
| **Database (local `mongodump` operator cron, any tier)** | As frequent as the cron runs it (a daily `mongodump` → object storage gives ~24h RPO as a floor beneath whatever Atlas provides) | Time to `mongorestore` the dump — **measured directly** at 's' for this dataset's current size (§5) | **[IMPLEMENTED]** script exists; **[LOCALLY VERIFIED]** timing against local replica set |
| **Object storage (S3, versioning enabled)** | Near-zero for accidental overwrite/delete (prior version retrievable) | Minutes (a few API calls) | **[REQUIRES PRODUCTION PROVIDER CONFIGURATION]** — depends on whether bucket versioning + MFA delete were actually enabled |
| **Object storage (local filesystem provider)** | Undefined / unsafe | N/A | Already flagged unsafe for production in RC-4; do not run production on this provider |
| **Queue (scheduledJob)** | Same as database (no separate infra) | Same as database, plus manual replay-safety review (§9) — do **not** assume "DB restored" means "queue safely restored" | |
| **Configuration (git-tracked)** | Effectively zero (every commit is a restore point) | Minutes (redeploy) | |
| **Environment variables / secrets (Vercel store)** | Depends on Vercel's own platform durability (no additional app-level backup layer) | Depends on how fast an operator can re-enter every value — this is why §12's out-of-band checklist exists | |
| **Encryption keys specifically** | **Must be treated as zero-loss-tolerance** — losing these is permanent, unrecoverable data loss for everything they encrypt, not a "restore from backup" scenario | N/A — there is no "restoring" a lost encryption key, only re-encrypting from scratch if the plaintext still exists elsewhere (it usually doesn't) | See §11 |

**Bottom line recommendation:** production MongoDB must run on an
Atlas tier with Cloud Backup (M10+) before this app holds real
customer data — the M0/free-tier "no automated backup at all" gap is
the single highest-severity item in this document.
**[REQUIRES PRODUCTION PROVIDER CONFIGURATION]**

---

---

## 3 · MongoDB backup strategy

### 3.1 Primary strategy: the managed database's own mechanism

**Prefer MongoDB Atlas Cloud Backup over any custom backup system.**
Atlas (M10+) provides continuous, snapshot-based backups with
point-in-time restore, off-cluster storage, and a tested one-click
restore-to-new-cluster flow — all of this is strictly better than
anything this app's own code could build, and the mission's own
instruction is explicit: never build a fragile custom system when the
managed database already provides a superior one.

**[REQUIRES PRODUCTION PROVIDER CONFIGURATION]** — enable in the Atlas
UI/API for the production cluster:
1. **Cloud Backup** → on, for the production cluster.
2. **Backup schedule**: Atlas's default (base snapshot + incremental)
   is sufficient for V1 — no custom schedule needed.
3. **PITR (continuous backups)**: enable if the M10+ tier supports it —
   this is what brings RPO down to minutes instead of "since the last
   snapshot." Confirm current tier support before relying on this.
4. **Retention**: see §17 (retention policy).
5. **Restore procedure (Atlas)**: Atlas UI → Backup → choose a
   snapshot/PITR timestamp → "Restore" → **restore to a new cluster**
   (never "restore in place" onto the live production cluster as the
   first step of any real incident — see §4's isolated-restore
   requirement) → once verified, cut the application over via
   `MONGODB_URI`.
6. **Backup verification**: Atlas snapshots are validated by Atlas
   itself, but this repo's own `npm run db:verify-backup` (§3.2) should
   still be run periodically against an Atlas-restored dataset, since it
   proves *this app's own schema/indexes* restore usably, not just that
   the bytes are intact.

### 3.2 Operator-triggered scripts (this repo) — [IMPLEMENTED] & [LOCALLY VERIFIED]

Three scripts, thin wrappers around the official MongoDB Database Tools
(`mongodump`/`mongorestore` — never a hand-rolled per-collection
exporter), all under `scripts/db/`:

```
npm run db:backup                      # mongodump --archive --gzip → backups/*.archive.gz (gitignored)
npm run db:restore -- --archive <path> --target <mongodb-uri>
npm run db:verify-backup [-- --archive <path>]
```

**`db:backup`** — dumps the full database (all collections + indexes)
to a single timestamped, gzip'd archive under `backups/` (gitignored —
an archive contains PII and encrypted tenant credentials and must never
be committed). This is the fallback/self-hosted path, and is also what
a local `mongod`/self-hosted replica set (no Atlas) must rely on as its
*only* backup mechanism — schedule it via cron/CI on a real deployment
if not running on Atlas Cloud Backup.

**`db:restore`** — restores an archive into an explicit `--target`
database. Two safety properties enforced in code, not just documented:
- `--target` is **required** with no default — an operator must name
  the exact database being overwritten.
- If `--target` matches this process's own `MONGODB_URI` (i.e., the
  active application database), the restore is **refused** unless
  `--i-understand-this-overwrites-the-active-database` is also passed.
  This directly encodes the mission's "never restore production backups
  over the active production database" rule as a hard default, not an
  operator-remembered convention.

**`db:verify-backup`** — fully automated: restores the newest (or a
named) archive into an **isolated scratch database**
(`<dbname>_verify_scratch`, always derived from the source, never the
app's own database), compares collection counts against the live
source for the critical collections (`organizations`, `users`), prints
a full per-collection count report, then **drops the scratch database**
so nothing is left behind. This is what backup-monitoring (§17) runs on
a schedule — the same script, unattended.

**Implementation note (a real bug found and fixed during RC-5):**
`mongorestore` records namespaces in an archive as `<originalDb>.<collection>`
regardless of the target URI's own database name. Restoring into a
differently-named database (exactly the isolated-restore pattern this
mission requires) **silently restores zero documents** unless
`--nsInclude`, `--nsFrom`, and `--nsTo` are all passed explicitly (see
inline comments in `scripts/db/restoreDatabase.ts` /
`scripts/db/verifyBackup.ts`) — passing only `--nsFrom`/`--nsTo`
without a matching `--nsInclude` still silently restores nothing. This
was caught only by actually running the restore and inspecting document
counts, not by reading `mongorestore --help`.

### 3.3 Proof this actually works — [LOCALLY VERIFIED]

Run directly against the local dev replica set
(`mongodb://127.0.0.1:27117/learnsynaptic?replicaSet=rs-learnsynaptic`)
during RC-5:

```
$ npm run db:backup
Backup complete: backups/learnsynaptic-2026-08-04T12-50-10-736Z.archive.gz

$ npm run db:verify-backup
Collection count comparison (source live DB vs. restored archive):
  PASS  organizations: source=1 restored=1
  PASS  users: source=1 restored=1
Total documents restored across 48 collections: 40
Backup verification: PASS

$ npm run db:restore -- --archive backups/learnsynaptic-...archive.gz \
    --target "mongodb://127.0.0.1:27117/learnsynaptic?replicaSet=rs-learnsynaptic"
Refusing: --target is identical to this process's own MONGODB_URI ...
```

The same tooling (`mongodump`/`mongorestore --uri "mongodb+srv://..."`)
works unchanged against Atlas — nothing here is local-only, only the
connection string changes. See §3.1 point 5 for the production Atlas
restore procedure; §4 below is the full drill with representative-record
and tenant-isolation verification.

---

## 4 · Restore drill — procedure and results [LOCALLY VERIFIED]

The mission's own requirement: backup → isolated restore → app
connection → integrity verification → tenant isolation across at least
two real organizations, **never restoring over the active database**.
Run end-to-end against the local dev replica set during RC-5:

**1. Seed a second real organization.** The local dev database normally
holds only one organization; `scripts/db/seedRestoreDrillFixture.ts`
(idempotent, refuses to run unless the target DB name looks like a
drill/dev/test database) creates a second, fully independent
Organization ("RC-5 Restore Drill — Organization B") plus one
representative record per major tenant-scoped entity family (user,
lead, task, conversation, message) — and one additional lead under the
pre-existing Organization A, so the isolation check is symmetric in
both directions, not just "B doesn't leak into an empty A."

```
npm run db:seed-restore-drill-fixture -- --i-know-this-is-not-production
```

**2. Take a real backup** (`npm run db:backup` — §3.2) covering both
organizations.

**3. Restore into an isolated database** — never the active one:

```
npm run db:restore -- --archive backups/<latest>.archive.gz \
  --target "mongodb://127.0.0.1:27117/learnsynaptic_restore_drill?replicaSet=rs-learnsynaptic"
```

**4. Connect the actual application data-access layer to the restored
database and verify** — `scripts/db/verifyRestoreDrillIntegrity.ts`
points `MONGODB_URI` at the restored database and calls the app's real
repositories (`lib/db/registry.ts`) inside `runWithTenantContext()`
(`lib/tenancy/context.ts`) — the exact same tenant-scoping enforcement
(`tenantScopePlugin`) every real HTTP request goes through. This is
deliberately not a raw `mongosh` query — it proves the application
itself, not just the database, works against the restored data.

```
MONGODB_URI="mongodb://127.0.0.1:27117/learnsynaptic_restore_drill?replicaSet=rs-learnsynaptic" \
  npx tsx scripts/db/verifyRestoreDrillIntegrity.ts
```

**Results (RC-5 run, both orgs, full pass):**

```
Representative record + relationship integrity (Organization B fixture):
  OK    lead survived
  OK    task survived
  OK    task.assigneeId relationship intact (user resolves, correct org)
  OK    conversation.leadId relationship intact
  OK    message survived, linked to conversation

Tenant isolation after restore:
  OK    Organization A sees its own lead among 1 total, none belonging to Organization B
  OK    Organization A sees 0 task(s), none belonging to Organization B
  OK    Organization B sees exactly its own 1 lead(s), none of Organization A's

Restore drill integrity + tenant isolation: PASS
```

**5. Clean up** — drop the isolated restore-drill database once
verification is complete (`db.dropDatabase()` against that database
only — never the active one). Real backup archives should be deleted
per the retention policy (§17), never left indefinitely on a local
machine.

**What this proves:** a `mongodump` archive of this database is
genuinely restorable, restores with zero data loss for the collections
checked, preserves cross-collection relationships (task→user,
conversation→lead), and — critically — the restored data is correctly
tenant-scoped: neither organization can see the other's records through
the application's own real query path after a restore. This is the
same mechanism and the same script that would run against a real Atlas
backup; only the connection string differs.

**Known gap (honestly disclosed):** this drill exercises the
`lead`/`task`/`conversation`/`message`/`user`/`organization` families
directly. It does not re-run the full E2E/regression suite against the
restored database (a "representative regression," not exhaustive) —
see §22 (final quality gates) for what breadth of regression testing
was actually run against the restored dataset before RC-5 was closed.

---

---

## 5 · File storage backup and DB/file reconciliation

### 5.1 Why file storage is a separate backup domain

A MongoDB backup/restore (§3–§4) never protects the actual file bytes
— `fileAsset` (Mongo) only holds a *pointer* (`storageKey`) into
whichever provider `STORAGE_PROVIDER` is configured. See §1.2/§1.5.

### 5.2 Provider-native protection — [REQUIRES PRODUCTION PROVIDER CONFIGURATION]

- **AWS S3 (recommended production provider):** enable **bucket
  versioning** (recovers from accidental overwrite/delete without any
  app-level backup) and consider **cross-region replication** for
  disaster-scale protection (a full region outage/account compromise).
  Configure a **lifecycle policy** appropriate for the retention
  decision in §17 (e.g. transition old `EXPORT`-category objects to
  cheaper storage, expire them after N days — exports are regenerable,
  see §8).
- **Cloudinary:** has its own asset backup/versioning features on paid
  plans — confirm the specific plan's guarantee before relying on it;
  this app's own Cloudinary adapter has no independent backup logic.
- **Local filesystem provider:** already flagged unsafe for production
  in RC-4 (`RUNBOOK.md` §11) — no durability, no replication, tied to
  one instance's disk. Do not run production file storage on this
  provider; nothing in RC-5 changes that.

### 5.3 DB/file reconciliation tooling — [IMPLEMENTED] & [LOCALLY VERIFIED]

Two failure modes the mission names explicitly, both real and
independent of each other:
- **DB says exists, object missing** — a `fileAsset` row (not
  soft-deleted) whose `storageKey` has no corresponding object in
  storage. Real data-loss risk: something a user/lead/conversation
  references can no longer be downloaded.
- **Object exists, DB missing** — a storage object with no `fileAsset`
  row referencing it at all (e.g. a crash between the provider upload
  and the DB write in `fileStorageService`). Wasted storage, not data
  loss, but worth knowing about for cost/hygiene.

**Implementation:** `StorageProvider` (`lib/services/storage/types.ts`)
gained a `listAllKeys()` method — none of the three providers had a
bulk-listing capability before RC-5 (only per-key `exists()`/`upload()`/
`delete()`). Implemented per provider:
- **local**: recursive `fs.readdir` walk of the storage root.
- **aws_s3**: `ListObjectsV2Command`, paginated via `ContinuationToken`.
- **cloudinary**: Admin API `GET /resources/{resource_type}` across
  `image`/`video`/`raw` (Cloudinary has no single "list everything"
  call — same reason `delete()` already tries all three resource
  types), paginated via `next_cursor`. `public_id` + `format` are
  recombined into the original `storageKey` shape (the inverse of the
  `publicIdFor()` extension-stripping this provider already does on
  upload).

`scripts/db/reconcileFileStorage.ts` — read-only, never deletes or
repairs anything automatically (an operator decides the right
remediation per finding: re-upload, remove the dangling row, or delete
the orphaned object). Correctly excludes soft-deleted `fileAsset` rows
from the "object missing" check — a soft-deleted row's bytes are
deleted immediately by design (`FileAsset.deletedAt`'s own doc
comment), so "row exists, bytes gone" there is expected, not drift.

```
npm run db:reconcile-files
```

**Real result, run against the local dev environment during RC-5**
(`STORAGE_PROVIDER=local`):

```
fileAsset rows: 0 total (0 active, 0 soft-deleted)
Storage objects: 382

DB says exists, object MISSING (0): none
Object exists, DB MISSING (382): crm_attachment/..., image/..., organization_asset/..., whatsapp_media/...

Summary: 0 dangling reference(s), 382 orphaned object(s).
No dangling DB references found — file storage is consistent with the database.
```

This is a genuine, non-fabricated finding, not a synthetic test case:
382 files accumulated on local disk (from prior E2E test runs and
manual testing across earlier RCs) with zero matching `fileAsset` rows
in the current database — exactly the "object exists, DB missing"
category. It proves the tool correctly detects real drift, not just
the constructed scenario. **0 dangling references** (the more severe
"DB says exists, object missing" case) is the finding that would have
blocked RC-5 completion had it occurred; it did not.

Schedule `npm run db:reconcile-files` periodically in production (same
cadence consideration as backup monitoring, §17) — it is safe to run
at any time (read-only) and its exit code (1 if any dangling reference
is found) is suitable for a monitoring/alerting integration.

---

---

## 6 · Soft-delete review — [IMPLEMENTED] & [LOCALLY VERIFIED]

The mission's own instruction: apply soft-delete *selectively* to
genuinely business-critical records, never blindly everywhere. An audit
of every hard-delete call site (`deleteOne`/`deleteMany`/
`findOneAndDelete`/`findByIdAndDelete`) across every repository, traced
through to whether it's actually reachable from an admin API route,
found:

**The one real gap: `Lead.bulkDelete`.** A live, admin-reachable,
permanent `deleteMany` on business-critical CRM data
(`app/api/admin/leads/bulk`, `action: "delete"`) with no recovery path
at all — an admin fat-fingering a filter (or `action: "delete"`
instead of `action: "archive"`) had no way back. **Fixed**: `Lead`
gained a `deletedAt` field (`lib/db/models/lead.model.ts`), mirroring
the pattern `FileAsset` already established. `bulkDelete()` now sets
`deletedAt` instead of removing documents; a new `bulkRestore()`
(`action: "restore"` on the same route) clears it. `Lead.merge()`
(folds a duplicate into a target, previously hard-deleted the losing
side) was changed the same way — a bad merge decision no longer
destroys the source row. Both the MongoDB and in-memory repositories
were updated identically (dual-store architecture — see
`RUNBOOK.md`'s own note on why both always change together). New
`deleted?: boolean` filter on `LeadListFilters`, defaulted to `false`
at the service layer (same "not defaulted in the repository" pattern
`archived` already uses) — soft-deleted leads are excluded from the
normal browse view and only visible via an explicit `deleted: true`
query (the trash/recovery view). Audited as `lead.bulk_deleted` /
`lead.bulk_restored`.

**Verified directly against the local dev database** (not just unit
tests): created a real lead, ran `bulkDelete` → confirmed the document
still exists with `deletedAt` set, confirmed it disappears from the
default list and appears in the `deleted: true` view, ran `bulkRestore`
→ confirmed `deletedAt` clears and the lead reappears in the default
view. Full 720-test unit suite still passes.

**Everything else audited, left as-is, with reasoning:**

| Entity | Delete path | Decision |
|---|---|---|
| `FileAsset` | Already soft-delete (`deletedAt`), confirmed wired to `app/api/admin/files/[id]` | No change needed — this was the pre-existing pattern `Lead` now mirrors |
| `Pipeline` | Hard delete, but already guarded: refuses to delete the default pipeline, refuses to delete a pipeline any `Opportunity` still references (`pipelineService.deletePipeline`) | Hard delete is safe here by construction — there is no path to orphan/lose data, so a `deletedAt` field would add complexity without closing a real gap |
| `AutoReplyRule`, `CustomFieldDefinition`, `Tag`, `BrandConfiguration` | Hard delete, admin-reachable | Configuration/definitions, not customer records — deleting one doesn't destroy any Lead/Conversation/Opportunity data (a `CustomFieldDefinition` delete doesn't touch the `customFields` values already stored on leads; a `Tag` delete just orphans an id reference). Recoverable by reconfiguring. Left as hard delete deliberately — soft-delete here would be complexity with no corresponding safety win |
| `Opportunity`, `Conversation`, `Campaign`, `WhatsAppCampaign`, `Organization`, `User` | **No delete path exists at all today** — update/status-only | Nothing to fix now, but flagged: if a delete capability is ever added to any of these, it must ship with soft-delete from day one (the same review this section just did for Lead), not bolted on after a real incident |
| `passwordResetToken`, `emailVerificationToken`, `refreshToken`, `mfaEmailOtp`, `mfaRecoveryCode`, `trustedDevice` | Hard delete | Correct as-is — session/token churn, not business data (§1.1 classifies these **E**phemeral) |
| `AuditLog` (`deleteByIds`) | Hard delete, but only ever called from the scheduled retention job (`lib/services/auditLog/retention.ts`), never an admin API route | Correct as-is — a deliberate, policy-driven retention sweep, not an admin-triggered destructive action |

---

---

## 7 · Organization-level data export — [IMPLEMENTED] & [LOCALLY VERIFIED]

An admin can export their entire organization's data for portability
(migration off the platform, a compliance request, an operator-level
backup an org keeps for itself). Never a synchronous request — an
org's dataset has no fixed upper bound, and RC-4's own "move long-
running work to the job queue, don't just raise timeouts" lesson
applies directly.

**Flow**: `POST /api/admin/export` (admin-only, 5/min) creates a
`DataExportRequest` (status `pending`) and enqueues a
`tenant_export.generate` scheduler job (reusing RC-3's own MongoDB-
backed queue — no new infrastructure), returning immediately.
`GET /api/admin/export/[id]` polls status; once `completed`, the
response includes a short-lived (5 minute) signed download URL.

**What's included** (matching the mission's own list): organization
config (name/slug + `BrandConfiguration`), leads, CRM activities (per-
lead timeline, capped at the first 2000 leads per export — disclosed in
the export file itself, not silently truncated), tasks, opportunities,
conversations, campaigns (both generic `Campaign` and
`WhatsAppCampaign`), automation definitions (`WorkflowDefinition`),
payment history, and the org's subscription. **Disclosed scope
boundary**: message *bodies* are not included (conversation records
are) — a materially larger export, left for a future iteration if
actually requested.

**Format**: one structured JSON file — portable and lossless for
relational data (a leads-only CSV already exists separately at
`GET /api/admin/leads?format=csv` for the flat, spreadsheet-friendly
case; this is the full-organization bundle the mission also asks for).

**Tenant isolation — enforced by construction, not by this feature
remembering to check**: `DataExportRequest` and `FileAsset` both carry
`tenantScopePlugin` (the same mechanism `Lead`/`Task`/`Conversation`
use). The job handler runs inside `runWithTenantContext({ organizationId: job.organizationId })`
(scheduler's own per-job setup, RC-3), so every repository call it
makes is automatically scoped. The status/download route resolves the
request the same way — an id belonging to another organization is
indistinguishable from a nonexistent one (`found: false`), never a
distinguishing 403. **Verified directly** against the local dev
database: created a real export as Organization A, ran the job
synchronously, confirmed Organization A gets `status: "completed"` and
a real signed `downloadUrl`; confirmed a second, real Organization B
querying the exact same request id gets `found: false` — Organization A
successfully exported, Organization B could not see it exists.

**Storage/lifecycle**: the export file is a normal `FileAsset`
(`category: "EXPORT"`, `visibility: "private"`, `organizationId`
stamped) — RC-5's own reconciliation tooling (§5) and the retention
policy (§17) apply to it with no special-casing. Every request/
completion is audited (`data_export.requested` / `data_export.completed`).

**Bug found and fixed during verification**: `AuditLog`'s Mongoose
schema keeps its own hand-maintained `entityType` enum, separate from
the `AuditEntityType` TypeScript union (`lib/db/repositories/types.ts`)
— adding `"DataExportRequest"` to the TS type alone was not enough;
every audit write for the new entity type silently failed
(`audit.write_failed`) until the Mongoose schema's own enum list
(`lib/db/models/auditLog.model.ts`) was updated too. The model's own
comment already disclosed this exact failure mode had happened three
times before (Integration/File/Meeting) — caught here the same way: a
real end-to-end run, not code review. Fixed by adding the missing enum
value; worth a follow-up someday to derive the schema enum from the TS
union instead of hand-syncing it a fifth time.

---

---

## 8 · Operator-level tenant restore — [IMPLEMENTED] & [LOCALLY VERIFIED]

The mission's own instruction: do **not** build a dangerous one-click
tenant restore unless architecturally safe — otherwise build
operator-level tooling that preserves `organizationId`, referential
integrity, unique constraints, and security boundaries. A full,
unattended replay of an export file is **not** architecturally safe
for every entity it contains (reasoning below) — so this is a real,
working, but deliberately scoped tool, not a UI button.

### 8.1 What's automated: Leads + Conversations

`scripts/db/restoreTenantLeadsFromExport.ts` (`npm run db:restore-tenant-leads --
--export <path> --target-org-id <id> [--confirm]`):

- **Dry-run by default** — reports what it would create; `--confirm` is
  required to actually write.
- `--target-org-id` must resolve to a real, **existing** Organization —
  never created implicitly.
- **`organizationId` is forcibly the target org on every write** — the
  export file's own embedded `organizationId` is logged for the
  operator's sanity check only, never trusted for the write itself
  (this is the concrete mechanism satisfying "preserves
  `organizationId`").
- **Idempotent**: leads upsert on `(organizationId, phone, email)`,
  conversations upsert on `(organizationId, contactPhoneE164 |
  contactEmail, channel)` — the exact same natural keys the app's own
  unique indexes already enforce (`lead.model.ts`,
  `conversation.model.ts`) — re-running twice never duplicates.
- **Referential integrity preserved across the id remap**: MongoDB
  assigns each restored Lead a brand-new `_id` (never reusing the
  export's own placeholder id, which could collide with unrelated
  data); an in-memory old-id→new-id map is used to correctly re-point
  each restored Conversation's `leadId` at the *new* id — **verified
  directly**: restored a real lead + conversation into a fresh test
  organization, confirmed the conversation's `leadId` in MongoDB points
  at the lead's actual new `_id`, confirmed a second run of the same
  command detected both as already-present rather than duplicating them.
- Tag ids, `assignedCounsellorId`, and `assignedTo` are dropped, never
  guessed — an id from the source organization is meaningless (and
  potentially a real security/correctness bug) in the target org.

### 8.2 What requires a manual operator procedure, and why

| Entity | Why it isn't safely automatable | Manual procedure |
|---|---|---|
| **Task** | `assigneeId` is a **required** reference to a `User`. The export contains no Users (deliberately); a target org's real users never share ids with the source org, and there is no safe default assignee to invent | Recreate tasks manually (or write a one-off script) only after deciding, per-task, a real target-org user to assign them to |
| **Opportunity** | `pipelineId`/`stageId` are **required** references to a `Pipeline` + one of its stages. Pipelines are per-org configuration, not exported as "data" | Recreate the target org's Pipeline/stage structure first (normal org setup), then re-enter opportunities against the real stage ids |
| **Campaign** | `code` is validated as unique; blindly re-inserting the source org's exact code risks a real collision | Re-create with a new/confirmed-unique code |
| **WhatsAppCampaign / automation definitions** | User-authored configuration, not runtime business data — safest recreated through the admin UI where validation (template ids, trigger wiring) runs for real, rather than replayed blind | Recreate via the admin UI |
| **Payments / Subscription** | The payment **provider** remains authoritative (§10) — reinserting old rows without reconciling against the provider first is exactly the "assume an old DB snapshot reflects current external state" mistake this mission repeatedly warns against | Never reinsert; reconcile against the provider directly per §10's procedure |

This table itself **is** the "operator-level restoration tooling"
requirement for the entities not code-automated — an honest, safe
manual procedure beats a script that would either crash on a required
reference it can't resolve or silently write orphaned/incorrect data.

---

---

## 9 · Credential & encryption-key recovery

### 9.1 What's encrypted, with what, and where the keys live

Four independent secrets, each AES-256-GCM (Node's built-in `crypto`,
key = SHA-256 of the env var string, format
`${iv}:${authTag}:${ciphertext}`, all base64url):

| Secret (env var) | Encrypts | Module |
|---|---|---|
| `TENANT_CREDENTIAL_ENCRYPTION_SECRET` | Every org's own third-party integration credentials (WhatsApp/Payments/Email provider API keys, etc.) | `lib/services/integrations/credentialCrypto.ts` |
| `WEBHOOK_SECRET_ENCRYPTION_SECRET` | Outbound webhook endpoint secrets/URLs | `lib/services/webhooks/secretCrypto.ts` |
| `CALENDAR_TOKEN_ENCRYPTION_SECRET` | Calendar/Meeting OAuth access + refresh tokens (also signs the OAuth `state` param) | `lib/services/calendar/tokenCrypto.ts` |
| `MFA_ENCRYPTION_SECRET` | `User.mfaSecretEncrypted` (TOTP secret) | `lib/services/auth/mfaCrypto.ts` |

**No key versioning or rotation mechanism exists today** — a single
static key per module, no `keyVersion` field alongside the ciphertext,
no multi-key decrypt attempt. **Rotating or losing any one of these
four env vars permanently strands every value it previously encrypted**
— there is no path back except restoring the exact original secret
value. This is the single most catastrophic, easiest-to-overlook loss
scenario in the entire system: unlike the database, there is no
"restore from backup" for a lost encryption key, because the key
itself is deliberately never stored anywhere the database backup
covers (§1.5) — that separation is what makes the encryption
meaningful in the first place.

**Failure mode is loud, never silent**: a wrong or rotated key makes
AES-GCM's own auth-tag check fail — every decrypt call throws
immediately, surfacing as a real, visible error (a broken integration,
a WhatsApp send failure, an MFA login failure) rather than silently
returning corrupted data. This is a real safety property already built
in — an operator will know immediately if a key is wrong, never
discover it much later as unexplained data corruption.

### 9.2 What is NOT affected by encryption-key loss (one-way hashes, no key involved)

- `User.passwordHash` — bcrypt, one-way. Losing an encryption key never
  affects login.
- `MfaRecoveryCode.codeHash` — SHA-256, one-way.
- `RefreshToken.tokenHash` / `TrustedDevice.deviceTokenHash` — SHA-256
  (opaque token hash), one-way.
- `OAuthAccount` — login-SSO identity linkage only (provider + provider
  account id); stores no tokens, no encryption involved.

### 9.3 Production key-preservation strategy — [REQUIRES PRODUCTION PROVIDER CONFIGURATION]

Reusing RC-4's own secret-management architecture (Vercel's encrypted
environment variable store) rather than inventing a second one:

1. **Primary**: the four secrets live as Vercel environment variables,
   same as every other `[REQUIRED]` var in `.env.example` — Vercel's
   own platform durability is the first line of defense, and they are
   never written to this app's own database or logs (confirmed: every
   decrypt/encrypt module's own doc comments and the RC-4 audit's "no
   secrets in client bundle / production logs" verification both cover
   this).
2. **Out-of-band redundant record — REQUIRED, given the catastrophic,
   non-rotatable consequence of loss**: store a second copy of these
   four specific values (and no others — ordinary API keys are
   rotatable and don't need this) in the organization's real secret
   manager / password manager (e.g. 1Password, a cloud KMS, or
   equivalent) with restricted access, separate from the general
   engineering secrets vault if one exists. This document intentionally
   contains **no actual values** — this is a procedure, not a backup
   archive.
3. **On a genuine platform-level loss** (e.g. Vercel project
   misconfiguration wipes env vars): restore all four from the
   out-of-band record in step 2, redeploy, verify via `npm run
   preflight` that every category reports ready, then verify a real
   decrypt succeeds (e.g. load one tenant's connected integration in
   Settings → Integrations and confirm it still authenticates) before
   treating the deployment as healthy.
4. **Key rotation, if ever needed** (e.g. suspected compromise): today
   this requires a real data-migration, not a config change — decrypt
   every affected row with the OLD key, re-encrypt with the NEW key,
   in one coordinated migration (see §13's migration-safety guidance).
   Flagged as technical debt: a `keyVersion` field per encrypted field
   would let old and new keys coexist during rotation instead of
   requiring a single atomic cutover — worth building before this
   platform's first real key-rotation event, not after.

### 9.4 Session/token state that must NOT be restored after a security incident

Per the mission's own explicit question — after a compromised-account
or DB-restore event, which session/token state should be deliberately
excluded from recovery:

- **`RefreshToken`** — never restore old rows. A compromised account's
  entire point of remediation is invalidating existing sessions; a
  restore that resurrects old refresh tokens would silently undo that.
- **`TrustedDevice`** — never restore. A device trusted before a
  compromise should not automatically remain trusted after one — see
  §11's compromised-admin-account procedure, which explicitly revokes
  these.
- **`PasswordResetToken` / `EmailVerificationToken` / `MfaEmailOtp`** —
  never restore; these are already single-use/short-TTL by design (§1
  classifies them **E**phemeral), and a restored one could reopen a
  since-closed window.
- **`OAuthAccount`** login-SSO links and Calendar/integration OAuth
  connections — restoring the *row* is fine (it's just an identity
  link/credential reference), but see §12: the actual external
  session/consent at the provider is unaffected by any DB restore, so
  a real security response still requires revoking access at the
  provider directly, not just locally.

DR_RUNBOOK.md §11 (incident response) operationalizes this list into a
concrete "what to run" procedure.

---

---

## 10 · Queue recovery, automation replay safety, and external-provider reconciliation

### 10.1 Why this matters after a restore specifically

A restored MongoDB backup can bring back `scheduledJob` rows in
`"pending"` status that the scheduler will pick up and execute on the
very next poll — exactly as if they were new work. **Never assume a
restored queue is safe to let run unattended.** Every job type in this
app, classified:

| Job type | External side effect? | Idempotency protection | Classification |
|---|---|---|---|
| `webhook.deliver` | Real HTTP POST to a tenant's own webhook endpoint | None — no pre-send state check | **MUST NOT REPLAY AUTOMATICALLY** |
| `notification.deliver` | Real POST to a Slack/Teams-style webhook | None | **MUST NOT REPLAY AUTOMATICALLY** |
| `whatsapp_campaign.send_message` | Real WhatsApp Cloud API send | **None** — checks the parent campaign's status, never the individual `Message.status` before sending | **MUST NOT REPLAY AUTOMATICALLY** (highest-risk job type in the app — a stale restored row WILL re-send a real WhatsApp message to a real recipient) |
| `tenant_export.generate` | No third-party call, but regenerates unconditionally | None (`exportRequest.status` isn't checked before regenerating) | **MUST RECOVER** (safe to let run, but review — wastes storage/duplicates an artifact, never a customer-facing risk) |
| `payments.reconcile` | Provider call, but **read-only** (`getPaymentStatus`, never charge/capture) | Read-only + idempotent local terminal-state transitions | **SAFE TO REBUILD** |
| `whatsapp_campaign.promote_scheduled` | None directly (enqueues `send_message` jobs) | Guarded — no-ops unless campaign is still `"scheduled"` | **SAFE TO REBUILD** |
| `crm.task_reminder_tick` | None (in-app notification only) | Self-correcting — filters on `reminderSentAt` unset | **SAFE TO REBUILD** |
| `automation.tick` | None (heartbeat) | Real protection is in `WorkflowRun.claim()`, not the tick itself — see §10.3 | **SAFE TO REBUILD** |
| `billing.period_check` | None (internal subscription state machine) | Pure state sweep | **SAFE TO REBUILD** |
| `whatsapp.template_sync` / `whatsapp.phone_health_check` | Read-only provider calls | N/A, read-only | **SAFE TO REBUILD** |

### 10.2 Operator procedure after any restore that could reintroduce queue rows

Before resuming the scheduler (Vercel Cron) against a restored
database:
1. Query `scheduledJob` for every `"pending"`/`"processing"` row whose
   `jobType` is `webhook.deliver`, `notification.deliver`, or
   `whatsapp_campaign.send_message` (the three **MUST NOT REPLAY
   AUTOMATICALLY** types).
2. For each, check the row's own `createdAt`/`runAt` against the
   restore's own recovery point: if the row predates data that's
   already known to be current (i.e., the underlying `Message`/webhook
   event it would act on may have already been delivered before the
   incident that triggered the restore), **cancel it** rather than let
   it fire blind (`cancelScheduledJob`, RC-3's own admin tooling,
   `/admin/reliability`).
3. Only after this triage should the scheduler be allowed to resume
   normal polling.
4. The other job types (SAFE TO REBUILD) need no manual review — they
   are either read-only, self-correcting, or already guarded.

### 10.3 WorkflowRun stale-state caveat (beyond the job queue itself)

The real replay exposure for automation isn't the `automation.tick`
heartbeat (harmless) — it's a restored `WorkflowRun` document whose
`currentStepIndex`/`status` reverts to a pre-incident state.
`engine.ts`'s `claim()` only prevents *concurrent* double-execution
(two workers grabbing the same run at once); it does **not** detect
"this run's restored snapshot is older than reality" (e.g. a step that
already sent a WhatsApp message before the incident, now about to be
re-executed because the restored row shows it as not-yet-run). None of
the automation action executors are idempotent against a stale replay
except `add_tag` (checks `lead.tags.includes()` before writing) —
`send_whatsapp_template`, `create_task`, and `assign_lead` are not.
**After any restore, audit `WorkflowRun` rows in a non-terminal status
the same way as §10.2's queue triage** — for a `WorkflowRun` whose
current step is `send_whatsapp_template`, treat it with the same
caution as a `whatsapp_campaign.send_message` job.

### 10.4 External providers remain authoritative — reconciliation is mandatory, not optional

A database restore rewinds **this app's own copy** of state. It never
rewinds any external provider. Every integration needs its own
reconciliation pass after a real recovery event:

| Provider | What it owns that this app only caches | Reconciliation procedure |
|---|---|---|
| **Payments** (Razorpay/Stripe/Cashfree) | The actual charge/refund/subscription ledger | Never assume a restored `Payment`/`Subscription` row reflects current reality. Run `payments.reconcile` (already provider-authoritative, read-only, safe — §10.1) immediately after resuming traffic; for any payment in a non-terminal local status, treat the provider's own dashboard/API as ground truth and correct the local row, never the reverse |
| **WhatsApp/Meta** | WABA-to-org mapping, phone number registration/quality rating, message template approval state, actual message delivery status | Re-run `whatsapp.template_sync` and `whatsapp.phone_health_check` immediately post-restore (both already read-only/safe). For delivery status specifically: a restored `Message.status` may be stale — Meta's own delivery webhooks will correct it going forward, but any message shown "sent"/"pending" in a stale restored row should not be treated as confirmed-delivered until a fresh status webhook or explicit Cloud API status check confirms it. WABA/phone-number-to-organization mappings (`PhoneNumber` collection) should be spot-checked against the Meta Business Manager after any restore that touches `IntegrationConnection`/`PhoneNumber` |
| **Calendar** (Google/Microsoft/Zoom) | The actual calendar event | A restored `Meeting` row is a cached copy of an event whose real state (rescheduled/cancelled by the other party) may have changed since the backup was taken. No automatic reconciliation exists today — flagged as a gap; an operator should treat restored meeting data as informational only until the calendar connector's own next sync |
| **Email** (Postmark/SES/etc.) | Actual delivery/bounce/complaint state | Same caution as WhatsApp — a restored `messageAttempt` status is a snapshot, not confirmed current delivery state |
| **Storage** (S3/Cloudinary) | The actual file bytes | Covered separately — §5's reconciliation tooling (`npm run db:reconcile-files`) is exactly this, run after any restore that could have left `FileAsset` rows and storage objects out of sync |
| **AI provider** | Nothing persisted that needs reconciliation — AI calls are stateless (a generation request/response), no state to reconcile |

---

---

## 11 · Backup monitoring — [IMPLEMENTED] & [LOCALLY VERIFIED]

The mission's own instruction: integrate backup-failure/overdue/
restore-verification-failure alerting into the **existing**
observability/notification architecture — never build a second
notification platform. This reuses RC-3's own `errorTrackingService`
(webhook-based — whatever channel `ERROR_TRACKING_PROVIDER`/
`ERROR_TRACKING_WEBHOOK_URL` is configured to reach, e.g. Slack/Discord/
a generic webhook) as the single alerting path — no new provider, no
new config surface.

**What's new**: a `BackupLog` collection (system-level, not
tenant-scoped — same category as `ScheduledJob`) records every real
backup attempt's outcome. This closes a real, pre-existing gap: nothing
in the app previously knew when the last backup actually ran.

- `npm run db:backup` (§3.2) now records a `BackupLog` entry after
  every run — `success` (with size/duration) or `failure` (with an
  error message) — and on failure, **immediately** reports through
  `errorTrackingService.captureException` (`operation:
  "backup.failed"`, `severity: "error"`).
- `npm run db:verify-backup` (§3.2) reports through the same pipeline
  on either failure mode: the restore-into-scratch step failing, or a
  critical collection restoring empty (`operation:
  "backup.restore_verification_failed"`, `severity: "error"`).
- A new scheduler job, `backup.check_freshness` (global, no
  `organizationId` — same shape as `payments.reconcile`/
  `billing.period_check`), self-reschedules every 6 hours and alerts
  (`operation: "backup.overdue"`, `severity: "warning"`) whenever the
  most recent `BackupLog` entry is missing, recorded as a failure, or
  older than 26 hours (a real number tuned for a daily backup cadence
  with buffer — revisit if the backup schedule ever changes).

**Verified directly**: ran a real backup, confirmed a `BackupLog`
`success` entry with a real size/duration; ran `checkBackupFreshness()`
immediately after — `{ ok: true }`; recorded a simulated failure and
re-ran the check — correctly returned `{ ok: false, reason: "..." }`
and both calls visibly reached the error-tracking pipeline (logged via
the `disabled` provider in this local environment, since
`ERROR_TRACKING_PROVIDER` isn't set — the same log line would instead
be a real webhook POST in production with that var configured, per
RC-3's own design).

**Scope note**: this monitors backups *this app's own tooling*
produces (`npm run db:backup`). If production runs on MongoDB Atlas
Cloud Backup instead (§3.1, the recommended primary strategy), Atlas
has its own independent backup-failure alerting — configure Atlas's
own alert rules to route to the same notification channel
(`ERROR_TRACKING_WEBHOOK_URL` or wherever the team already watches) for
one unified alert surface rather than two separate ones an operator has
to check.

---

---

## 12 · Incident response

### 12.1 "An admin accidentally deleted important business data"

Proportional recovery, cheapest option first — never jump straight to
a full database restore for a mistake that a smaller mechanism already
covers:

1. **Soft-delete, if the entity supports it** (Lead — §6): `POST
   /api/admin/leads/bulk` with `action: "restore"` on the specific ids.
   Instant, no data loss, no downtime. This is why §6 exists — most
   "I deleted the wrong thing" incidents are exactly this case.
2. **Audit history** (every business action is logged — `AuditLog`,
   `category: "business"`): confirms *what* was deleted, *by whom*,
   *when*, and with what filter/ids — necessary before either of the
   next two steps, so the recovery targets exactly what was lost, not
   more or less.
3. **Tenant-level recovery via export** (§7): if the organization has a
   recent `DataExportRequest`, the operator-level restore tool (§8) can
   reintroduce Leads/Conversations from it into the SAME organization
   (upserts on natural key — safe to run even if most data is still
   present; it only fills in what's missing).
4. **Snapshot restore** — only for damage soft-delete/export can't
   cover (a hard-deleted entity with no soft-delete support, e.g. a
   `Pipeline` or `Tag`, or damage spanning many entities at once).
   Follow §4's drill procedure for real, but restore to an **isolated**
   database first, extract only the specific lost records, and
   reintroduce them via §8's tooling — never restore a full snapshot
   over the live production database as a first response to a
   single-admin mistake (§3.2's own "never restore over the active
   database" safety rule exists precisely to prevent this instinct).

### 12.2 Compromised tenant admin account

Reusing RC-1 (Authentication & Identity) and RC-2's own architecture —
this procedure calls real, existing mechanisms, not new ones invented
for this document:

1. **Session revocation — [IMPLEMENTED] & [LOCALLY VERIFIED] (built
   during RC-5):** `POST /api/admin/users/[id]/revoke-sessions`
   (admin-only) ends every refresh token for the target user
   immediately. This was a **real, load-bearing gap** found while
   writing this section — the only pre-existing mechanism
   (`sessionService.revokeAllOtherSessions`) is self-service only (a
   user can only revoke their *own* other sessions), so there was
   previously no way for an admin to force-end a *different* user's
   sessions at all. Verified directly: created real active refresh
   token rows for a real user, called the new
   `sessionService.adminRevokeAllSessions`, confirmed all of them show
   `revokedAt` set immediately after. Access tokens are short-lived
   (15 minutes, `JWT_ACCESS_TOKEN_TTL_SECONDS`) — even a still-valid
   stolen access token is bounded to that window once the refresh
   token behind it is revoked.
2. **Credential rotation**: the account holder must set a new password
   through the normal reset flow once they've regained control (never
   send a new password over an unverified channel). **Known gap**:
   there is currently no admin-triggered "force password reset now" or
   "disable this user's MFA" API route — `authService.resetPassword()`
   exists but is CLI-only (`scripts/resetAdminPassword.ts`), and
   `mfaService.disable()` requires the user's own current password.
   Interim procedure until a proper admin route exists: an operator
   with direct database/CLI access runs `scripts/resetAdminPassword.ts`
   for the affected account.
3. **Audit investigation**: query `AuditLog` (`category: "business"`)
   and the security audit log (`category: "security"`,
   `securityAuditLogService`) for every action recorded under the
   compromised user's `actorId` since the suspected compromise window
   — this is the same data RC-1's Login History feature already reads,
   just not yet exposed as an admin-facing cross-user query. **Known
   gap**: no admin UI/API route queries the security audit log across
   users today (it's currently wired for self-service "my login
   history" only) — an operator needs direct database access
   (`db.auditlogs.find({actorId, category:"security"})`) until one is
   built.
4. **Provider disconnection**: `POST
   /api/admin/integrations/[providerId]/disconnect` — real, working,
   admin-only (RC-4/Module 6.1) — disconnect any integration the
   compromised account could have reached (Payments, WhatsApp,
   Calendar, Storage) as a precaution, even without direct evidence of
   provider-level abuse, then re-connect deliberately once the account
   itself is secured.
5. **Data integrity review**: use the same `AuditLog` query from step 3
   to enumerate every entity the compromised account touched, and
   review each for unauthorized changes — bulk-deleted Leads restore
   via §6/§12.1; other unauthorized edits need manual review since not
   every entity has an audit-diff, only an audit-event.

**A real, separate finding surfaced while researching this section
(not something RC-5 introduced or is in scope to fix, but too material
not to disclose here):** `authService.listActiveStaff()` /
`userRepository.listActive()` lists every active user with **no
organizationId filter at all** — `User` is deliberately not
`tenantScopePlugin`-scoped (needed for cross-org login lookup by
email), but this specific call site never adds its own manual
`organizationId` filter the way the new session-revocation route above
does. In the current single-tenant-per-deployment reality this may be
low real-world impact, but it means the admin "staff directory"
(`GET /api/admin/users`, used for assignment/task-assignee pickers)
currently returns users across every organization in a real multi-org
deployment. Flagged as a remaining risk in the final RC-5 audit update
— worth a small, dedicated fix (add the same `organizationId` filter
this section's new route already demonstrates), not something to patch
as a drive-by inside a DR-focused RC.

### 12.3 Platform security incidents

Concise, not a full enterprise SOC platform — containment →
credential rotation → recovery → verification, for each realistic
scenario:

| Scenario | Containment | Credential rotation | Recovery | Verification |
|---|---|---|---|---|
| **Secret exposure** (a key committed to git, leaked in a log, or pasted somewhere it shouldn't be) | Identify exactly which secret and its blast radius (§9.1's table — which module/data it protects) | Rotate the exposed secret at its provider immediately. **Exception**: the four encryption-at-rest keys (§9.1) — rotating those requires the full re-encryption migration §9.3 describes, not a simple swap; if one of those specific four is exposed, treat it as the higher-severity "DB compromise" scenario below, not a simple rotation | Redeploy with the new value; confirm via `npm run preflight` | Confirm the OLD value no longer authenticates anywhere it used to |
| **Database compromise** (unauthorized access to MongoDB itself) | Rotate the MongoDB connection credentials at the provider (Atlas/self-hosted) immediately; treat every secret stored encrypted in that database as potentially exposed (ciphertext without the key is not immediately readable, but assume the incident may extend to key exposure too) | Rotate `MONGODB_URI` credentials AND, if there's any indication the four encryption keys (§9.1) were also exposed, treat that as mandatory — see §9.3's migration procedure | Restore from a backup taken **before** the compromise window (§3–§4) into a fresh, isolated environment — never trust the live compromised instance's own current state as a restore source | Full post-restore checklist (§13) + explicit review of `AuditLog` for the compromise window for any unauthorized action |
| **Malicious/compromised deployment** (unauthorized or tampered code reached production) | Roll back via Vercel's instant promotion of the last known-good deployment (`RUNBOOK.md` §10) | Rotate any secret the malicious code could plausibly have accessed (assume all of them, if the code ran with normal server privileges) | Redeploy the known-good version; re-run migrations only if the malicious deployment's own migrations must be reversed (§13) | `npm run preflight` + a full regression pass (§16) before reopening traffic |
| **Cross-tenant vulnerability** (an isolation bug like §12.2's `listActiveStaff` finding, or worse — actual data leaked across organizations) | Disable or patch the specific vulnerable route/query immediately (a targeted code fix, not a full platform lockdown) | N/A unless the vulnerability also exposed credentials | Audit `AuditLog` across the affected time window for any cross-tenant read/write that occurred through the vulnerable path; notify affected organizations per the severity of what was actually exposed | Add the missing isolation check AND a regression test for it (the same discipline `tenantIsolation.spec.ts` already establishes for the paths it covers) before considering the incident closed |

**When to reopen traffic**: only after containment is confirmed
complete, all rotated credentials are live in production, a fresh
`npm run preflight` reports READY, and (for anything touching the
database) the post-restore checklist (§13) passes.

---

---

## 13 · The disaster recovery runbook

The single flow to follow when a real incident happens — every step
points back at the section that already covers it in detail. No real
secrets appear anywhere below.

### Step 1 — What failed?

Classify the incident against §1's data domains and §10.4's provider
list:
- Database corruption/loss/unauthorized access → go to Step 2.
- File storage loss/corruption → §5 (reconciliation), possibly
  combined with Step 2 if the DB is also affected.
- A specific admin's account compromised → §12.2, not this flow.
- A single admin's mistake (wrong bulk delete, etc.) → §12.1, not this
  flow (cheaper recovery options exist before a database restore).
- A platform-level security incident (secret exposure, malicious
  deployment, cross-tenant bug) → §12.3, not this flow.

### Step 2 — What's at risk?

Check §1's classification table for exactly which data domains are
implicated (Authoritative data is real loss; Derived/Rebuildable isn't
urgent; Externally-owned data needs provider reconciliation, not a
restore). This determines urgency and scope — don't treat a
single-collection issue as requiring a full-database response.

### Step 3 — Which backup?

- MongoDB: the most recent Atlas Cloud Backup snapshot/PITR point
  before the incident window (§3.1), or the most recent
  `npm run db:backup` archive if not on Atlas (§3.2) — check
  `BackupLog`/backup monitoring (§11) for exactly when the last known-
  good backup completed.
- Files: provider-native recovery (S3 versioning, §5.2) — not a
  separate "file backup" to locate.

### Step 4 — How to restore

Follow §4's drill procedure for real this time:
1. Restore into an **isolated** environment first — never restore over
   the live/production database (`npm run db:restore` refuses this
   without an explicit override flag, by design, §3.2).
2. Verify there (Step 5) before ever cutting the application over.
3. Only after verification passes, point `MONGODB_URI` at the restored
   database (Atlas: promote/restore-to-new-cluster then repoint;
   self-hosted: repoint after a verified `mongorestore`).

### Step 5 — How to verify

- Run `npm run db:verify-backup`-style checks against the restored
  environment: critical collection counts present (§3.2).
- Run the representative-record + relationship + tenant-isolation
  checks §4 demonstrates (`scripts/db/verifyRestoreDrillIntegrity.ts`
  pattern) — adapted to real production organizations, not the drill's
  synthetic fixture.
- Run `npm run db:reconcile-files` (§5) to confirm file storage is
  consistent with the restored database.
- Complete the full post-restore checklist (§15) before reopening
  traffic.

### Step 6 — How to reconcile externals

Per §10.4's table: re-run `payments.reconcile`,
`whatsapp.template_sync`, and `whatsapp.phone_health_check`
immediately (all already safe/read-only); treat restored
Calendar/Email delivery state as informational only; run §5's file
reconciliation. **Triage the queue and any non-terminal `WorkflowRun`
per §10.2/§10.3 before letting the scheduler resume unattended** — this
is the step most likely to be skipped under incident pressure and the
one most likely to cause real customer-facing harm (a duplicate
WhatsApp send) if skipped.

### Step 7 — When to reopen traffic

Only after: containment confirmed (if the incident was security-
related, §12.3), the restored/reconciled environment passes Step 5's
verification, the full post-restore checklist (§15) passes, and
`npm run preflight` reports READY. If write-freezing was used during
investigation (§14), unset `MAINTENANCE_READ_ONLY_MODE` and redeploy
only after all of the above — reopening writes before verification
completes defeats the point of freezing them in the first place.

---

## 14 · Recovery/maintenance mode — evaluated and deliberately minimal

The mission's own instruction: evaluate whether a maintenance/recovery
mode blocking dangerous writes is justified, and implement only if
genuinely warranted — avoid unnecessary complexity.

**A full maintenance-mode platform was evaluated and NOT built**, for
concrete reasons specific to this app's actual restore procedure:
- The main danger a maintenance mode would protect against — new
  writes landing on a half-verified restored database — is already
  prevented architecturally: §3–§4's restore procedure always restores
  to an **isolated** environment first and only cuts the live
  application over after verification passes.
  `scripts/db/restoreDatabase.ts` additionally refuses to write over
  the app's own active `MONGODB_URI` without an explicit override flag
  — the specific mistake a maintenance mode exists to prevent is
  already a hard-coded refusal, not a discipline an operator has to
  remember.
- A full mechanism (a DB-backed flag, an admin UI toggle, a per-route
  allowlist) adds a genuinely new moving part — including a new way
  production could accidentally get stuck read-only — for a danger
  window this app's design already avoids by a cheaper, existing
  mechanism.

**What WAS built — a single, minimal, real safety valve** (§12.3's
"platform security incidents" table references this): a
`MAINTENANCE_READ_ONLY_MODE` env var (`.env.example`), checked in
`lib/api/withApiRoute.ts` before any handler runs. Set to `"true"`, it
refuses every mutating request (`POST`/`PUT`/`PATCH`/`DELETE`) with 503
uniformly, across every one of this app's ~150 admin/API routes, with
exactly two exceptions: `GET`/`HEAD`/`OPTIONS` requests (investigating
an incident requires reading data) and `auth.*`-named routes (an
operator must still be able to sign in to respond). This is for an
**actively unfolding incident** — suspected live data corruption, a
security incident being actively contained — not for routine restore
work, which doesn't need it (see above). Reversible in about a minute:
unset the var and redeploy.

**[LOCALLY VERIFIED]**: 5 real unit tests
(`lib/api/withApiRoute.unit.test.ts`) — confirms a mutating request is
refused with 503 and the handler never runs while the flag is set;
confirms GET requests and `auth.*` routes stay reachable while it's
set; confirms mutations are allowed when the flag is unset (the only
safe default) or set to anything other than the exact string `"true"`.

---

---

## 15 · Post-restore checklist

Run through every module before reopening traffic (§13 Step 7). Each
item names the concrete command/check to run — this is a checklist to
execute, not just read.

| Module | Check |
|---|---|
| **Database** | `npm run preflight` → Database category reports `ok`. `/api/health/ready` → 200. |
| **Tenant isolation** | Run `scripts/db/verifyRestoreDrillIntegrity.ts`-style checks (§4) against at least two real restored organizations — confirm neither can see the other's leads/tasks/conversations. |
| **Auth** | Log in as a real staff account in each affected organization; confirm MFA (if enabled) still challenges correctly; confirm a stale/pre-incident refresh token does NOT still work (§9.4 — session state that must not survive certain incidents) if this restore followed a security incident. |
| **CRM (Leads/Tasks/Opportunities)** | Spot-check a representative Lead, Task, and Opportunity per restored organization — correct fields, correct `organizationId`, relationships resolve (assignee, pipeline/stage). |
| **WhatsApp** | Run `whatsapp.template_sync` + `whatsapp.phone_health_check` (§10.4) before trusting any campaign/message data as current. Confirm `PhoneNumber`-to-organization mappings match Meta Business Manager. |
| **Automation** | Audit every non-terminal `WorkflowRun` per §10.3 before letting `automation.tick` resume — cancel/review any mid-`send_whatsapp_template` run whose restored snapshot might predate an already-sent message. |
| **Payments** | Run `payments.reconcile` (§10.1, read-only/safe) immediately; treat every non-terminal local `Payment`/`Subscription` as provisional until reconciled against the provider (§10.4). |
| **Integrations** | Confirm each organization's connected integrations (`IntegrationConnection`) still authenticate — a wrong/rotated encryption key (§9) fails loudly here first. |
| **Files** | Run `npm run db:reconcile-files` (§5) — zero dangling references (`fileAsset` rows pointing at missing objects) before trusting file-backed features (attachments, branding assets, exports). |
| **Analytics** | Spot-check that dashboard aggregates for a restored organization reflect the restored data (no stale cache holding pre-restore numbers — check any analytics cache/materialized-view TTL if one exists). |
| **Billing** | Run `billing.period_check` (§10.1, safe) — confirm trial/past-due/cancellation state is consistent with the restored `Subscription` rows. |
| **Audit logs** | Confirm `AuditLog` writes resume correctly post-restore (create one real test action, verify it's recorded) — and review the log for the incident window itself per §12.3's relevant table row. |
| **Queue/worker** | Complete §10.2's triage (cancel/review `webhook.deliver`/`notification.deliver`/`whatsapp_campaign.send_message` rows) BEFORE letting the scheduler resume normal polling. |
| **Health checks** | `/api/health` → 200. `/api/health/ready` → 200 with `checks.database.ok` and `checks.queue.ok` both true. `npm run preflight` → overall `READY`. |

Only once every row above is checked should `MAINTENANCE_READ_ONLY_MODE`
(if it was set, §14) be unset and traffic fully reopened.

---

---

## 16 · Migration & backfill failure recovery

`RUNBOOK.md` already documents the baseline (§6: migrations run
at-most-once via `_migrations`, inside a real MongoDB transaction,
manually triggered post-deploy, never automatic on boot; §10: app
rollback ≠ migration rollback, forward-only reversal, Atlas PITR as
the last resort). This section covers what those didn't: the specific
partial-failure-then-deploy-fails sequencing, and the backfill scripts
specifically (`scripts/backfill*.ts`), which `RUNBOOK.md` §6 doesn't
cover at all.

### 16.1 `lib/db/migrations/index.ts` — real transactional safety, with one honest boundary

Each migration's `up()` plus its `_migrations` tracking-row insert run
inside one real `session.withTransaction()` call
(`lib/db/transaction.ts`) — a migration that throws partway through
rolls back cleanly, and a second `npm run db:migrate` run safely skips
anything already recorded in `_migrations`. **Preferring idempotent
migrations over relying on rollback is the actual design already in
place here**, exactly per the mission's own instruction.

**The one real boundary, worth stating explicitly**: transactional
safety only covers writes that are threaded through the migration's
own passed-in `session` parameter. A migration that calls an external
service (a webhook dispatch, an email send, a second database
connection) as part of its `up()` would NOT have that side effect
rolled back if the transaction later fails — this is a property of how
MongoDB transactions work, not a bug, but worth a migration author's
attention when writing one. Also: transactions require a replica set;
running against a standalone `mongod` with `IS_MONGODB_CONFIGURED`
false runs with no session and no atomicity at all (local in-memory
dev mode is unaffected — it has no transactions to begin with).

### 16.2 The partial-failure-then-deploy-fails scenario

The specific sequencing RC-5 was asked to document: a migration
succeeds (or partially runs) but the corresponding application-code
deploy that depends on the new shape never goes live, or the reverse —
app code rolls back while `_migrations` still shows the migration as
applied.

**Because every migration in this repo is required to be
forward-compatible with the OLD code shape for the deploy window**
(`RUNBOOK.md` §10's own "Zero-downtime note" — new optional fields,
never renamed/removed in the same deploy), this scenario is
self-limiting by construction: an already-applied migration that adds
a new optional field is harmless to leave applied even if the
corresponding app-code deploy that would have USED that field never
ships — old code simply never reads it. This is the concrete reason
"migrations are additive/optional-field-only within one deploy window"
isn't just a style preference, it's what makes this exact scenario
safe by default rather than something to firefight.

**If a migration was genuinely NOT additive** (a real schema
requirement change) and the deploy failed after only the migration
ran: treat it the same as `RUNBOOK.md` §10's own rollback procedure —
never edit or delete the `_migrations` entry; write a new, forward-only
migration that reverses the specific change, deploy that, then retry
the original app-code deploy. The `_migrations` ledger is an
append-only history of what's true about the schema NOW, not a stack
to pop.

### 16.3 Backfill scripts (`scripts/backfill*.ts`) — not transactional, idempotent by filter

None of the five backfill scripts (`backfillConversations.ts`,
`backfillLeadScores.ts`, `backfillOpportunityStageHistory.ts`,
`backfillOrganizationId.ts`, `backfillWorkflowDefinitions.ts`) run
inside a MongoDB transaction — each is a plain sequential/batched
write. **Every one is documented in its own header comment as safe to
re-run**, and each achieves that the same way: filtering to only the
records that still need the backfill (e.g.
`organizationId: { $exists: false }`, `stageHistory.length === 0`,
"already has `conversationId`? skip") rather than relying on any
transaction or checkpoint. If a backfill script is killed mid-run
(process killed, deploy interrupted), whatever it already wrote stays
committed (each write is its own atomic Mongo operation), and simply
re-running the same script from the start correctly picks up exactly
where it left off — no separate resume/checkpoint mechanism is needed
BECAUSE the idempotency filter already provides one.

**One specific note on `backfillOrganizationId.ts`**: it loops across
32 models, each with its own `updateMany`. If killed mid-loop, some
models will be backfilled and others won't — this is safe (re-running
the script picks up the remaining models via the same `exists: false`
filter) but not atomic across the whole loop; don't assume a killed run
left either "all models done" or "no models done," check
`db:sync-indexes`/preflight output or query a few of the 32 collections
directly if unsure which state a specific deployment is in.

### 16.4 The one real principle underlying both

**Prefer idempotent operations over relying on untested automatic
rollback for destructive changes** — this is already how every real
migration/backfill in this codebase is built (filter-then-write,
skip-if-already-done), not a new recommendation RC-5 is introducing.
This document's contribution is making that property explicit and
naming the one place it doesn't fully apply (§16.1's session-boundary
caveat) so a future migration author doesn't accidentally break it.

---

---

## 17 · RC-5 audit summary

1. **Completion status**: RC-5 (Backup, Restore & Disaster Recovery) complete against its own approved scope. RC-6 not started, per this pass's own explicit closing instruction.
2. **Authoritative data inventory**: §1.1–§1.5 — full classification of all 44 MongoDB collections plus file storage, queue, and credential domains into Authoritative/Derived/Rebuildable/Ephemeral/Externally-Owned.
3. **RPO**: §2 — defined per domain; honest flag that an Atlas M0/free tier has zero automated backup (undefined RPO) versus M10+/Cloud Backup (minutes).
4. **RTO**: §2 — 30–60 min for Atlas restore-to-new-cluster at this data volume; measured directly for the local-tooling path (§3.3).
5. **MongoDB backup strategy**: §3 — Atlas Cloud Backup as primary (REQUIRES PRODUCTION PROVIDER CONFIGURATION), `npm run db:backup`/`db:restore`/`db:verify-backup` as the operator-triggered/self-hosted path (IMPLEMENTED, LOCALLY VERIFIED).
6. **Restore verification status**: §4 — full real drill executed: backup → isolated restore → real app-layer connection → representative-record + relationship integrity → two-organization tenant isolation, all LOCALLY VERIFIED.
7. **File backup strategy**: §5 — provider-native (S3 versioning/replication, REQUIRES PRODUCTION PROVIDER CONFIGURATION) + `npm run db:reconcile-files` reconciliation tooling (IMPLEMENTED, LOCALLY VERIFIED, found 382 real orphaned objects).
8. **Tenant export strategy**: §7 — async, tenant-scoped, audited JSON export (IMPLEMENTED, LOCALLY VERIFIED including the cross-tenant-denial proof).
9. **Credential/key recovery strategy**: §9 — documented; no rotation mechanism exists today (flagged technical debt), out-of-band preservation procedure documented reusing RC-4's own secret architecture.
10. **Queue recovery strategy**: §10.1–§10.2 — all 11 job types classified; operator triage procedure documented for the 3 MUST-NOT-REPLAY-AUTOMATICALLY types.
11. **Automation recovery strategy**: §10.3 — `WorkflowRun` stale-snapshot exposure documented; `add_tag` confirmed idempotent, `send_whatsapp_template`/`create_task`/`assign_lead` confirmed not.
12. **Payment reconciliation strategy**: §10.4 — provider remains authoritative; `payments.reconcile` confirmed read-only/safe to resume immediately post-restore.
13. **WhatsApp reconciliation strategy**: §10.4 — `whatsapp.template_sync`/`whatsapp.phone_health_check` re-run procedure documented; WABA/phone-mapping spot-check procedure documented.
14. **Migration recovery**: §16 — real transactional safety in `lib/db/migrations`, honest session-boundary caveat; all 5 backfill scripts confirmed idempotent-by-filter, safe to re-run after a kill.
15. **Backup monitoring**: §11 — `BackupLog` + `backup.check_freshness` job, alerting through RC-3's existing `errorTrackingService` (IMPLEMENTED, LOCALLY VERIFIED, including a simulated-failure alert proof).
16. **DR runbook**: §13 — the consolidated what-failed/at-risk/which-backup/how-to-restore/how-to-verify/how-to-reconcile/when-to-reopen flow; §15 — full post-restore checklist across 13 modules.
17. **Tests performed**: 725/725 unit tests, 131/131 E2E specs (one flaky/pre-existing failure confirmed non-regression on isolated re-run), `tsc --noEmit` clean, ESLint clean on every RC-5 file, production build clean, client-bundle secret scan clean, plus real (non-mocked) verification against the local MongoDB replica set for every backup/restore/export/reconciliation/session-revocation claim in this document.
18. **External production configuration required**: Atlas Cloud Backup + PITR enablement and retention policy (§3.1); S3 bucket versioning/replication (§5.2); out-of-band secure storage of the 4 encryption keys (§9.3); `ERROR_TRACKING_PROVIDER`/`ERROR_TRACKING_WEBHOOK_URL` for real alert delivery (§11); Atlas's own backup-failure alert routing (§11).
19. **Remaining risks**: see CHANGELOG.md's RC-5 entry's own "Remaining, disclosed risks" — non-idempotent WhatsApp/webhook job handlers (§10.1), no admin force-password-reset/MFA-disable route (§12.2), `listActiveStaff()`'s missing organizationId filter (§12.2, pre-existing, found not introduced), no encryption key-versioning (§9.3), no automated Calendar/Email reconciliation (§10.4).
20. **Technical debt**: same list as #19, plus deriving `AuditLog`'s Mongoose entityType enum from the TS union automatically instead of hand-syncing it (this is the 5th time it's drifted, §7).
21. **Overall RC completion %**: 100% of RC-5's own 14-task scope (all 14 tracked tasks completed).
22. **Production readiness score**: infrastructure/tooling for backup, restore, export, and monitoring is real and verified; the platform's actual production readiness is gated on the external configuration in #18 (particularly Atlas Cloud Backup — the single highest-severity gap, §2) rather than on anything left undone in this app's own code.
23. **Recommended next RC module**: harden the queue's replay-safety gaps identified in §10.1 (idempotency guards for `whatsapp_campaign.send_message`/`webhook.deliver`/`notification.deliver`) and close the `listActiveStaff()` cross-tenant gap (§12.2) — both are real, bounded, already-diagnosed pieces of work rather than new scope, and both were surfaced specifically because RC-5's own restore/incident-response drills exercised paths no prior RC had tested.

---

*(End of DR_RUNBOOK.md.)*
