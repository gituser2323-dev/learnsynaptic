import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl as getS3PresignedUrl } from "@aws-sdk/s3-request-presigner";
import { AWS_S3_CONFIG } from "@/config/storage";
import { StorageProviderNotConfiguredError, StorageProviderError } from "../errors";
import { buildContentDispositionHeader } from "../validation";
import type { StorageDownloadOptions, StorageProvider, StorageUploadInput, StorageUploadResult } from "../types";

/**
 * Real AWS S3 adapter — the official SDK, not hand-rolled SigV4
 * signing. Unlike this codebase's fetch-only AI/WhatsApp/Email vendor
 * adapters (all simple bearer-token REST APIs), S3 request signing is
 * genuinely complex cryptographic work where a subtly wrong hand
 * implementation fails every real call with a cryptic
 * SignatureDoesNotMatch — the official, security-maintained package is
 * the responsible choice here, not a style deviation.
 */
let cachedClient: S3Client | null = null;
function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: AWS_S3_CONFIG.region,
    credentials: { accessKeyId: AWS_S3_CONFIG.accessKeyId, secretAccessKey: AWS_S3_CONFIG.secretAccessKey },
  });
  return cachedClient;
}

function assertConfigured(): void {
  if (!AWS_S3_CONFIG.bucket || !AWS_S3_CONFIG.region || !AWS_S3_CONFIG.accessKeyId || !AWS_S3_CONFIG.secretAccessKey) {
    throw new StorageProviderNotConfiguredError("aws_s3", "AWS_S3_BUCKET/AWS_S3_REGION/AWS_S3_ACCESS_KEY_ID/AWS_S3_SECRET_ACCESS_KEY must all be set");
  }
}

function publicUrlFor(storageKey: string): string {
  if (AWS_S3_CONFIG.publicBaseUrl) return `${AWS_S3_CONFIG.publicBaseUrl.replace(/\/$/, "")}/${storageKey}`;
  return `https://${AWS_S3_CONFIG.bucket}.s3.${AWS_S3_CONFIG.region}.amazonaws.com/${storageKey}`;
}

export const awsS3StorageProvider: StorageProvider = {
  id: "aws_s3",

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    assertConfigured();
    try {
      await getClient().send(
        new PutObjectCommand({
          Bucket: AWS_S3_CONFIG.bucket,
          Key: input.storageKey,
          Body: input.buffer,
          ContentType: input.mimeType,
          ACL: input.visibility === "public" ? "public-read" : "private",
        }),
      );
      return { storageKey: input.storageKey, publicUrl: input.visibility === "public" ? publicUrlFor(input.storageKey) : undefined };
    } catch (error) {
      throw new StorageProviderError("aws_s3", error instanceof Error ? error.message : "unknown upload error");
    }
  },

  async delete(storageKey: string): Promise<void> {
    assertConfigured();
    try {
      await getClient().send(new DeleteObjectCommand({ Bucket: AWS_S3_CONFIG.bucket, Key: storageKey }));
    } catch (error) {
      throw new StorageProviderError("aws_s3", error instanceof Error ? error.message : "unknown delete error");
    }
  },

  async exists(storageKey: string): Promise<boolean> {
    assertConfigured();
    try {
      await getClient().send(new HeadObjectCommand({ Bucket: AWS_S3_CONFIG.bucket, Key: storageKey }));
      return true;
    } catch {
      return false;
    }
  },

  getPublicUrl(storageKey: string): string | null {
    if (!AWS_S3_CONFIG.bucket) return null;
    return publicUrlFor(storageKey);
  },

  async getSignedUrl(storageKey: string, expiresInSeconds: number, downloadOptions?: StorageDownloadOptions): Promise<string> {
    assertConfigured();
    try {
      // RC-2 — "safe downloads": ResponseContentDisposition is a real,
      // documented S3 presigned-URL parameter forcing the browser to
      // download rather than render the object inline, regardless of
      // the Content-Type the object was originally uploaded with.
      const command = new GetObjectCommand({
        Bucket: AWS_S3_CONFIG.bucket,
        Key: storageKey,
        ResponseContentDisposition: downloadOptions?.filename ? buildContentDispositionHeader(downloadOptions.filename) : undefined,
      });
      return await getS3PresignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
    } catch (error) {
      throw new StorageProviderError("aws_s3", error instanceof Error ? error.message : "unknown signing error");
    }
  },

  async listAllKeys(): Promise<string[]> {
    assertConfigured();
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const response = await getClient().send(
        new ListObjectsV2Command({ Bucket: AWS_S3_CONFIG.bucket, ContinuationToken: continuationToken }),
      );
      for (const object of response.Contents ?? []) {
        if (object.Key) keys.push(object.Key);
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
    return keys;
  },
};
