import { getConnection } from "@/lib/db/connection";
import { FileAssetModel } from "@/lib/db/models/fileAsset.model";
import { getStorageProvider } from "@/lib/services/storage/registry";

/**
 * RC-5 — Backup, Restore & Disaster Recovery.
 *
 * File storage is a SEPARATE backup domain from MongoDB (DR_RUNBOOK.md
 * §1.2) — a database backup/restore never proves the actual file bytes
 * in S3/Cloudinary/local storage are still consistent with what the
 * `fileAsset` collection thinks exists. This script finds both classes
 * of drift the mission names explicitly:
 *
 *   - DB says exists, object missing: a `fileAsset` row (not soft-
 *     deleted) whose `storageKey` has no corresponding object in the
 *     configured storage provider — real data loss, or a delete that
 *     removed the bytes without updating/removing the row.
 *   - Object exists, DB missing: a storage object with no `fileAsset`
 *     row referencing its key at all — an orphaned upload (e.g. a
 *     crash between provider upload and the DB write in
 *     fileStorageService), pure wasted storage, not data loss.
 *
 * Soft-deleted fileAsset rows (`deletedAt` set) are EXCLUDED from the
 * "object missing" check — by design (see FileAsset's own doc comment
 * in lib/services/storage/types.ts) their bytes are deleted immediately
 * while the metadata row persists as an audit trail, so "row exists,
 * bytes gone" is expected and correct for those, not drift.
 *
 * Read-only — reports drift, never deletes or repairs anything
 * automatically (an operator decides the right remediation per finding:
 * re-upload, remove the dangling row, or delete the orphaned object).
 *
 * Usage:
 *   npm run db:reconcile-files
 */

async function main(): Promise<void> {
  await getConnection();
  const provider = getStorageProvider();

  console.log(`Reconciling file storage — provider: ${provider.id}\n`);

  const dbRows = await FileAssetModel.find({}, { storageKey: 1, deletedAt: 1, originalFilename: 1, organizationId: 1 }).lean();
  const activeDbKeys = new Map<string, { originalFilename: string; organizationId?: string }>();
  let softDeletedCount = 0;
  for (const row of dbRows) {
    if (row.deletedAt) {
      softDeletedCount += 1;
      continue;
    }
    activeDbKeys.set(row.storageKey, { originalFilename: row.originalFilename, organizationId: row.organizationId?.toString() });
  }

  console.log(`fileAsset rows: ${dbRows.length} total (${activeDbKeys.size} active, ${softDeletedCount} soft-deleted)`);

  const storageKeys = new Set(await provider.listAllKeys());
  console.log(`Storage objects: ${storageKeys.size}\n`);

  const dbSaysExistsObjectMissing: { storageKey: string; originalFilename: string; organizationId?: string }[] = [];
  for (const [storageKey, meta] of activeDbKeys) {
    if (!storageKeys.has(storageKey)) {
      dbSaysExistsObjectMissing.push({ storageKey, ...meta });
    }
  }

  const objectExistsDbMissing: string[] = [];
  for (const storageKey of storageKeys) {
    if (!activeDbKeys.has(storageKey)) {
      objectExistsDbMissing.push(storageKey);
    }
  }

  console.log(`DB says exists, object MISSING (${dbSaysExistsObjectMissing.length}):`);
  if (dbSaysExistsObjectMissing.length === 0) {
    console.log("  none");
  } else {
    for (const item of dbSaysExistsObjectMissing) {
      console.log(`  ${item.storageKey}  "${item.originalFilename}"  org=${item.organizationId ?? "(none)"}`);
    }
  }

  console.log(`\nObject exists, DB MISSING (${objectExistsDbMissing.length}):`);
  if (objectExistsDbMissing.length === 0) {
    console.log("  none");
  } else {
    for (const key of objectExistsDbMissing) {
      console.log(`  ${key}`);
    }
  }

  console.log(
    `\nSummary: ${dbSaysExistsObjectMissing.length} dangling reference(s), ${objectExistsDbMissing.length} orphaned object(s).`,
  );

  if (dbSaysExistsObjectMissing.length > 0) {
    console.error(
      "\nDangling references found — this is real data loss risk (an entity references a file that " +
        "no longer exists). Investigate before treating this environment as trustworthy. See " +
        "DR_RUNBOOK.md §5 for remediation guidance.",
    );
    process.exit(1);
  }

  console.log("\nNo dangling DB references found — file storage is consistent with the database.");
  process.exit(0);
}

main().catch((error) => {
  console.error("File reconciliation script crashed:", error);
  process.exit(1);
});
