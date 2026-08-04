import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);

/**
 * File Storage (Phase 6), Module 6.2 — Generic Storage Provider.
 *
 * The webServer under test runs with no STORAGE_PROVIDER env var set,
 * so the active provider is "local" throughout (real files written to
 * and read back from `.storage-uploads/` on disk, not mocked) — the
 * aws_s3/cloudinary "not connected" gate and Cloudinary's disclosed
 * private-signing gap are already covered at the unit level
 * (fileStorageService.unit.test.ts), where flipping the active
 * provider via env is actually possible; a single shared dev server
 * can't do that per-test.
 */
test.describe("File Storage (6.2)", () => {
  test("an unauthenticated request is rejected on every generic file route", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    const uploadResponse = await context.request.post(`${baseURL}/api/admin/files`, {
      multipart: { file: { name: "photo.png", mimeType: "image/png", buffer: PNG_BYTES }, category: "IMAGE" },
    });
    expect(uploadResponse.status()).toBe(401);

    const listResponse = await context.request.get(`${baseURL}/api/admin/files`);
    expect(listResponse.status()).toBe(401);
    await context.close();
  });

  test("counsellor can upload, fetch metadata, download, and delete a file over real HTTP", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");

    const uploadResponse = await context.request.post(`${baseURL}/api/admin/files`, {
      multipart: { file: { name: "photo.png", mimeType: "image/png", buffer: PNG_BYTES }, category: "IMAGE", visibility: "public" },
    });
    expect(uploadResponse.ok()).toBeTruthy();
    const uploadBody = await uploadResponse.json();
    const file = uploadBody.file;
    expect(file.provider).toBe("local");
    expect(file.sizeBytes).toBe(PNG_BYTES.length);
    expect(file.publicUrl).toBeFalsy(); // local has no real public host

    const getResponse = await context.request.get(`${baseURL}/api/admin/files/${file.id}`);
    expect(getResponse.ok()).toBeTruthy();
    expect((await getResponse.json()).file.id).toBe(file.id);

    // The download route redirects to a real, signed local delivery URL
    // — and that delivery URL is itself deliberately unauthenticated
    // (the signature is the access control), so fetch it with a fresh,
    // cookie-less context to prove that.
    const downloadResponse = await context.request.get(`${baseURL}/api/admin/files/${file.id}/download`, { maxRedirects: 0 });
    expect(downloadResponse.status()).toBe(307);
    const signedUrl = downloadResponse.headers()["location"];
    expect(signedUrl).toMatch(/\/api\/files\/local\//);

    const anonymousContext = await browser.newContext();
    const bytesResponse = await anonymousContext.request.get(signedUrl);
    expect(bytesResponse.ok()).toBeTruthy();
    expect(Buffer.from(await bytesResponse.body())).toEqual(PNG_BYTES);
    await anonymousContext.close();

    const deleteResponse = await context.request.delete(`${baseURL}/api/admin/files/${file.id}`);
    expect(deleteResponse.ok()).toBeTruthy();

    const getAfterDeleteResponse = await context.request.get(`${baseURL}/api/admin/files/${file.id}`);
    expect(getAfterDeleteResponse.status()).toBe(404);

    // The real bytes are gone too — the same signed URL 404s now.
    const bytesAfterDeleteResponse = await context.request.get(signedUrl);
    expect(bytesAfterDeleteResponse.status()).toBe(404);

    await context.close();
  });

  test("rejects a file exceeding its category's size limit", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    const oversized = Buffer.alloc(11 * 1024 * 1024);
    PNG_BYTES.copy(oversized);
    const response = await context.request.post(`${baseURL}/api/admin/files`, {
      multipart: { file: { name: "big.png", mimeType: "image/png", buffer: oversized }, category: "IMAGE" },
    });
    expect(response.status()).toBe(400);
    await context.close();
  });

  test("rejects a dangerous file extension regardless of declared MIME type", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    const response = await context.request.post(`${baseURL}/api/admin/files`, {
      multipart: {
        file: { name: "payload.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") },
        category: "OTHER",
      },
    });
    expect(response.status()).toBe(400);
    await context.close();
  });

  test("rejects content whose magic bytes don't match its declared MIME type", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const response = await context.request.post(`${baseURL}/api/admin/files`, {
      multipart: { file: { name: "fake.png", mimeType: "image/png", buffer: jpegBytes }, category: "IMAGE" },
    });
    expect(response.status()).toBe(400);
    await context.close();
  });

  test("404s fetching, downloading, or deleting a nonexistent file id", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    expect((await context.request.get(`${baseURL}/api/admin/files/not-a-real-id`)).status()).toBe(404);
    expect((await context.request.get(`${baseURL}/api/admin/files/not-a-real-id/download`)).status()).toBe(404);
    expect((await context.request.delete(`${baseURL}/api/admin/files/not-a-real-id`)).status()).toBe(404);
    await context.close();
  });

  test("the local signed-delivery route rejects a tampered signature", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    const uploadResponse = await context.request.post(`${baseURL}/api/admin/files`, {
      multipart: { file: { name: "photo.png", mimeType: "image/png", buffer: PNG_BYTES }, category: "IMAGE", visibility: "public" },
    });
    const file = (await uploadResponse.json()).file;
    const downloadResponse = await context.request.get(`${baseURL}/api/admin/files/${file.id}/download`, { maxRedirects: 0 });
    const signedUrl = downloadResponse.headers()["location"] as string;

    const tamperedUrl = signedUrl.replace(/sig=[^&]+/, "sig=0000000000000000000000000000000000000000000000000000000000000000");
    const anonymousContext = await browser.newContext();
    const response = await anonymousContext.request.get(tamperedUrl);
    expect(response.status()).toBe(403);
    await anonymousContext.close();
    await context.close();
  });

  test("lists files scoped to a relatedEntityType/relatedEntityId, e.g. a Lead's attachments", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "counsellor");
    const leadId = `e2e-lead-${Date.now()}`;

    const uploadResponse = await context.request.post(`${baseURL}/api/admin/files`, {
      multipart: {
        file: { name: "contract.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") },
        category: "CRM_ATTACHMENT",
        visibility: "private",
        relatedEntityType: "Lead",
        relatedEntityId: leadId,
      },
    });
    expect(uploadResponse.ok()).toBeTruthy();

    const listResponse = await context.request.get(
      `${baseURL}/api/admin/files?relatedEntityType=Lead&relatedEntityId=${leadId}`,
    );
    expect(listResponse.ok()).toBeTruthy();
    const listBody = await listResponse.json();
    expect(listBody.total).toBe(1);
    expect(listBody.items[0].relatedEntityId).toBe(leadId);
    await context.close();
  });
});
