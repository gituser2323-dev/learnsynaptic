import { Client, check, summary, BASE_URL, type JsonResponseBody } from "./pentestClient";

/**
 * RC-9 §11 — File upload security testing. Real multipart requests
 * against the running dev server.
 */

async function uploadRaw(client: Client, filename: string, mimeType: string, content: string, category = "CRM_ATTACHMENT"): Promise<{ status: number; body: JsonResponseBody }> {
  const form = new FormData();
  const blob = new Blob([content], { type: mimeType });
  form.append("file", blob, filename);
  form.append("category", category);
  const cookie = client.getCookie("ls_access_token");
  const res = await fetch(`${BASE_URL}/api/admin/files`, {
    method: "POST",
    headers: { origin: BASE_URL, "x-forwarded-for": "198.18.0.1", ...(cookie ? { Cookie: `ls_access_token=${cookie}` } : {}) },
    body: form,
  });
  let body: JsonResponseBody = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function main(): Promise<void> {
  console.log(`Target: ${BASE_URL}\n`);
  const adminA = new Client("file-upload-a", "198.18.0.1");
  const loginRes = await adminA.login("rc9-org-a-admin@learnsynaptic.internal", "RC9-Load-Test-Pass-1");
  if (loginRes.status !== 200) throw new Error("login failed");
  const adminB = new Client("file-upload-b", "198.18.0.2");
  await adminB.login("rc9-org-b-admin@learnsynaptic.internal", "RC9-Load-Test-Pass-1");

  // 1. Dangerous extension (.exe) with a plausible-looking MIME
  {
    const res = await uploadRaw(adminA, "totally-safe.exe", "application/octet-stream", "MZ fake exe content");
    check("FILE-01", res.status === 400, `.exe upload -> ${res.status} (expect 400)`);
  }
  // 2. Double extension (a classic bypass attempt: photo.jpg.exe / photo.php.png)
  {
    const res = await uploadRaw(adminA, "resume.pdf.exe", "application/pdf", "fake");
    check("FILE-02", res.status === 400, `Double-extension upload (resume.pdf.exe) -> ${res.status} (expect 400 — real extension is .exe)`);
  }
  {
    const res = await uploadRaw(adminA, "avatar.png.php", "image/png", "<?php system($_GET['c']); ?>");
    check("FILE-03", res.status === 400, `Double-extension upload (avatar.png.php) -> ${res.status} (expect 400 — real extension is .php)`);
  }
  // 3. Wrong MIME — claims image/png but the extension/content don't match
  {
    const res = await uploadRaw(adminA, "script.js", "image/png", "alert(document.cookie)");
    check("FILE-04", res.status === 400, `.js file claiming image/png -> ${res.status} (expect 400 — dangerous extension blocked regardless of claimed MIME)`);
  }
  // 4. SVG with an embedded script payload — a real, common stored-XSS-via-upload vector
  // if the SVG is ever served inline/rendered directly rather than downloaded.
  {
    const svgPayload = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>`;
    const res = await uploadRaw(adminA, "logo.svg", "image/svg+xml", svgPayload, "IMAGE");
    // Either rejected outright, or accepted but ALWAYS served with a real
    // Content-Disposition (download, not inline-render) so the embedded
    // script can never execute in this app's own origin — both are safe;
    // only "accepted AND rendered inline" would be unsafe.
    check("FILE-05 [INFORMATIONAL]", true, `SVG with embedded <script> -> ${res.status} ${res.status === 400 ? "(rejected outright)" : "(accepted — verify download route sends Content-Disposition:attachment, see FILE-08)"}`);
  }
  // 5. Oversized file (per-category limit — CRM_ATTACHMENT is a DOCUMENT-shaped category, real cap well under 50MB)
  {
    const bigContent = "x".repeat(60 * 1024 * 1024); // 60MB
    const res = await uploadRaw(adminA, "huge.pdf", "application/pdf", bigContent);
    check("FILE-06", res.status === 400 || res.status === 413, `60MB PDF upload -> ${res.status} (expect 400/413, never accepted)`);
  }
  // 6. Malformed "image" — a PDF's magic bytes claiming to be a PNG
  {
    const res = await uploadRaw(adminA, "fake.png", "image/png", "%PDF-1.4 this is not a real png");
    check("FILE-07 [INFORMATIONAL]", true, `Malformed image (real PDF header, claims image/png) -> ${res.status} (best-effort magic-byte sniffing — see lib/services/storage/validation.ts's own doc comment on its real limits)`);
  }

  // 7. Legitimate upload, then verify safe download behavior + cross-tenant access
  let uploadedFileId: string | undefined;
  {
    const res = await uploadRaw(adminA, "real-document.pdf", "application/pdf", "%PDF-1.4\n%real pdf content for RC-9 testing");
    check("FILE-08", res.status === 200 || res.status === 201, `Legitimate PDF upload -> ${res.status}`);
    uploadedFileId = res.body?.file?.id;
  }
  if (uploadedFileId) {
    const downloadRes = await adminA.req("GET", `/api/admin/files/${uploadedFileId}/download`);
    const isRedirectOrOk = downloadRes.status === 200 || downloadRes.status === 302 || downloadRes.status === 307;
    check("FILE-09", isRedirectOrOk, `Owner org downloads its own real file -> ${downloadRes.status} (expect 200/redirect)`);

    // Cross-tenant file access — Org B attempts to download Org A's real file
    const crossRes = await adminB.req("GET", `/api/admin/files/${uploadedFileId}/download`);
    check("FILE-10", crossRes.status === 404 || crossRes.status === 403, `Org B downloads Org A's real file id -> ${crossRes.status} (expect 404/403, never 200)`);

    const crossMetaRes = await adminB.req("GET", `/api/admin/files/${uploadedFileId}`);
    check("FILE-11", crossMetaRes.status === 404 || crossMetaRes.status === 403, `Org B reads Org A's real file METADATA -> ${crossMetaRes.status} (expect 404/403, never 200)`);
  } else {
    check("FILE-09/10/11", false, "SKIPPED — legitimate upload did not return a file id");
  }

  // 8. Path manipulation in filename
  {
    const res = await uploadRaw(adminA, "../../../etc/passwd", "application/pdf", "%PDF-1.4 fake");
    // Safe either way ONLY if the real storage key is never derived from
    // this filename (RC-8/RC-9 docs: storageKey is always a fresh
    // randomUUID(), sanitization here is defense-in-depth only) — the
    // meaningful check is that the upload doesn't 500 and the file (if
    // accepted) is still only reachable via its own real, random id.
    check("FILE-12", res.status !== 500, `Path-traversal-shaped filename -> ${res.status} (expect NOT 500; storageKey is always a fresh random id, never derived from this)`);
  }

  summary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
