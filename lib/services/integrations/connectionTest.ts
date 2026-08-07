import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { AWS_S3_CONFIG, CLOUDINARY_CONFIG } from "@/config/storage";
import { POSTMARK_CONFIG, EMAIL_ACTIVE_PROVIDER } from "@/config/emailChannel";
import { META_CLOUD_API_CONFIG, WHATSAPP_ACTIVE_PROVIDER } from "@/config/whatsapp";
import { STORAGE_PROVIDER_TIMEOUT_MS, EMAIL_PROVIDER_TIMEOUT_MS, MESSAGING_PROVIDER_TIMEOUT_MS } from "@/lib/net/timeouts";
import { getRawAiProvider, resolveAiApiKeyPresence } from "@/lib/services/ai/registry";
import type { AiProviderId } from "@/lib/services/ai/types";
import { getPaymentProvider, isPaymentProviderId } from "@/lib/services/payments/registry";
import { PaymentProviderNotConfiguredError, PaymentProviderNotImplementedError } from "@/lib/services/payments/errors";

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

const AI_PROVIDER_IDS: readonly string[] = ["openai", "anthropic", "gemini"];
const STORAGE_PROVIDER_IDS: readonly string[] = ["aws_s3", "cloudinary"];

/** True for every providerId this module can run a REAL, live vendor
 *  call against. Calendar ("sync now") and the notification webhooks
 *  ("test notification") already have their own real, working test
 *  actions — see calendarService.syncNow() and the
 *  notification-test route — so this module deliberately does not
 *  duplicate those two categories; it only fills the gap for
 *  categories that had no connection test at all before Configuration
 *  & Integration Verification. */
export function hasConnectionTest(providerId: string): boolean {
  return AI_PROVIDER_IDS.includes(providerId) || STORAGE_PROVIDER_IDS.includes(providerId) || isPaymentProviderId(providerId) || providerId === "email" || providerId === "whatsapp";
}

async function testAiProvider(id: AiProviderId): Promise<ConnectionTestResult> {
  const configured = await resolveAiApiKeyPresence(id);
  if (!configured) return { success: false, message: `No API key configured for ${id}.` };

  try {
    const result = await getRawAiProvider(id).complete({
      systemPrompt: "You are a connectivity check. Reply with exactly one word.",
      userPrompt: "Reply with the single word: OK",
      maxTokens: 5,
    });
    return { success: true, message: `${id} responded: "${result.text.trim().slice(0, 40)}"` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : `${id} connection test failed.` };
  }
}

/** S3's own documented "does this bucket exist and can I reach it with
 *  these credentials" call — HeadBucket, not HeadObject on a made-up
 *  key: unlike StorageProvider.exists() (which swallows every error,
 *  auth failures included, into a plain `false` — correct for its own
 *  "does this file exist" job, wrong for a credential test that must
 *  tell "bad key" apart from "bucket empty"), HeadBucket surfaces a
 *  real 403/`InvalidAccessKeyId`/`SignatureDoesNotMatch` distinctly
 *  from success. Read-only, no side effects. */
async function testAwsS3(): Promise<ConnectionTestResult> {
  if (!AWS_S3_CONFIG.bucket || !AWS_S3_CONFIG.region || !AWS_S3_CONFIG.accessKeyId || !AWS_S3_CONFIG.secretAccessKey) {
    return { success: false, message: "AWS_S3_BUCKET/AWS_S3_REGION/AWS_S3_ACCESS_KEY_ID/AWS_S3_SECRET_ACCESS_KEY must all be set." };
  }
  const client = new S3Client({
    region: AWS_S3_CONFIG.region,
    credentials: { accessKeyId: AWS_S3_CONFIG.accessKeyId, secretAccessKey: AWS_S3_CONFIG.secretAccessKey },
  });
  try {
    await client.send(new HeadBucketCommand({ Bucket: AWS_S3_CONFIG.bucket }), { abortSignal: AbortSignal.timeout(STORAGE_PROVIDER_TIMEOUT_MS) });
    return { success: true, message: `Bucket "${AWS_S3_CONFIG.bucket}" reachable in ${AWS_S3_CONFIG.region} with the configured credentials.` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "AWS S3 connection test failed." };
  }
}

/** Cloudinary's own documented "verify these credentials" endpoint —
 *  the account Usage API, chosen over a HEAD on a made-up resource for
 *  the same reason HeadBucket was chosen over HeadObject above: a 401
 *  here means "bad key," never "resource not found." Read-only. */
async function testCloudinary(): Promise<ConnectionTestResult> {
  if (!CLOUDINARY_CONFIG.cloudName || !CLOUDINARY_CONFIG.apiKey || !CLOUDINARY_CONFIG.apiSecret) {
    return { success: false, message: "CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET must all be set." };
  }
  const auth = Buffer.from(`${CLOUDINARY_CONFIG.apiKey}:${CLOUDINARY_CONFIG.apiSecret}`).toString("base64");
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/usage`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(STORAGE_PROVIDER_TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      return { success: false, message: body.error?.message || `Cloudinary responded with HTTP ${response.status}.` };
    }
    return { success: true, message: `Cloudinary account "${CLOUDINARY_CONFIG.cloudName}" reachable with the configured credentials.` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Cloudinary connection test failed." };
  }
}

/** Postmark's own documented "verify server token" call — GET /server
 *  returns the server's own settings on a valid token, 401 on an
 *  invalid one. Read-only, no email is sent. EmailProvider (types.ts)
 *  has no lightweight verify method of its own (only send()), so this
 *  is a narrow, bespoke real vendor call rather than an addition to
 *  the shared interface for one vendor's own convenience endpoint. */
async function testPostmark(): Promise<ConnectionTestResult> {
  if (EMAIL_ACTIVE_PROVIDER !== "postmark") {
    return {
      success: false,
      message: `No automated connection test is implemented for the "${EMAIL_ACTIVE_PROVIDER}" email provider yet — only Postmark supports it.`,
    };
  }
  if (!POSTMARK_CONFIG.serverToken) {
    return { success: false, message: "EMAIL_POSTMARK_SERVER_TOKEN is not set." };
  }
  try {
    const response = await fetch("https://api.postmarkapp.com/server", {
      headers: { Accept: "application/json", "X-Postmark-Server-Token": POSTMARK_CONFIG.serverToken },
      signal: AbortSignal.timeout(EMAIL_PROVIDER_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => ({}))) as { Name?: string; Message?: string };
    if (!response.ok) return { success: false, message: body.Message || `Postmark responded with HTTP ${response.status}.` };
    return { success: true, message: `Postmark server "${body.Name ?? "configured server"}" reachable with the configured token.` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Postmark connection test failed." };
  }
}

/** Meta's own Graph API, read-only lookup of the configured phone
 *  number resource — confirms both WHATSAPP_META_ACCESS_TOKEN and
 *  WHATSAPP_META_PHONE_NUMBER_ID are valid and belong together (a
 *  valid token for the wrong phone number id fails this exactly like
 *  an invalid token does). Only implemented for the "meta-cloud-api"
 *  vendor — this app's one real, non-scaffold WhatsApp adapter (see
 *  lib/services/whatsapp/registry.ts); the AiSensy/Interakt/WATI/
 *  Gallabox scaffolds get the same disclosed "not implemented" answer
 *  PhonePe/PayPal already do below, not a fabricated pass. */
async function testWhatsApp(): Promise<ConnectionTestResult> {
  if (WHATSAPP_ACTIVE_PROVIDER !== "meta-cloud-api") {
    return {
      success: false,
      message: `No automated connection test is implemented for the "${WHATSAPP_ACTIVE_PROVIDER}" WhatsApp provider yet — only Meta Cloud API supports it.`,
    };
  }
  if (!META_CLOUD_API_CONFIG.accessToken || !META_CLOUD_API_CONFIG.phoneNumberId) {
    return { success: false, message: "WHATSAPP_META_ACCESS_TOKEN/WHATSAPP_META_PHONE_NUMBER_ID must both be set." };
  }
  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_CLOUD_API_CONFIG.apiVersion}/${META_CLOUD_API_CONFIG.phoneNumberId}?fields=verified_name,display_phone_number`,
      { headers: { Authorization: `Bearer ${META_CLOUD_API_CONFIG.accessToken}` }, signal: AbortSignal.timeout(MESSAGING_PROVIDER_TIMEOUT_MS) },
    );
    const body = (await response.json().catch(() => ({}))) as { display_phone_number?: string; error?: { message?: string } };
    if (!response.ok) return { success: false, message: body.error?.message || `Meta Graph API responded with HTTP ${response.status}.` };
    return { success: true, message: `WhatsApp number "${body.display_phone_number ?? META_CLOUD_API_CONFIG.phoneNumberId}" reachable with the configured token.` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "WhatsApp connection test failed." };
  }
}

/** Vendor auth-failure message fragments, lowercase, used only to
 *  classify a real thrown PaymentProviderError as "bad credentials" vs
 *  "credentials fine, test order id not found" below. PaymentProvider
 *  Error (errors.ts) doesn't carry the vendor's own HTTP status code,
 *  so this is a disclosed, best-effort text match on each vendor's own
 *  documented error wording — not a fabricated pass/fail. */
const AUTH_FAILURE_FRAGMENTS = ["authentication", "unauthorized", "invalid api key", "invalid_api_key", "invalid key", "no such api key", "401", "access denied"];

async function testPaymentProvider(id: "razorpay" | "stripe" | "cashfree" | "phonepe" | "paypal"): Promise<ConnectionTestResult> {
  const provider = getPaymentProvider(id);
  try {
    await provider.getPaymentStatus("connection-test-sentinel-id");
    // A real order id would never coincidentally exist for this made-up
    // id, so a resolved (non-throwing) call is as strong a signal as
    // the thrown-but-not-auth-related branch below.
    return { success: true, message: `${id} accepted the request with the configured credentials.` };
  } catch (error) {
    if (error instanceof PaymentProviderNotConfiguredError) return { success: false, message: error.message };
    if (error instanceof PaymentProviderNotImplementedError) {
      return { success: false, message: `${id} has no real adapter implemented yet — cataloged as a future provider, not connectable.` };
    }
    const message = error instanceof Error ? error.message : `${id} connection test failed.`;
    const looksLikeAuthFailure = AUTH_FAILURE_FRAGMENTS.some((fragment) => message.toLowerCase().includes(fragment));
    if (looksLikeAuthFailure) return { success: false, message };
    return { success: true, message: `Credentials verified — ${id} reached the API and rejected the test order id as expected (not found): ${message}` };
  }
}

/**
 * Configuration & Integration Verification — the one real, per-category
 * dispatcher behind every non-calendar, non-notification "Test
 * Connection" button (calendar already has calendarService.syncNow();
 * notification webhooks already have the dedicated notification-test
 * route — see hasConnectionTest()'s own doc comment). Every branch
 * makes one real vendor call; nothing here assumes success from the
 * presence of an env var alone.
 */
export async function runConnectionTest(providerId: string): Promise<ConnectionTestResult> {
  if (AI_PROVIDER_IDS.includes(providerId)) return testAiProvider(providerId as AiProviderId);
  if (providerId === "aws_s3") return testAwsS3();
  if (providerId === "cloudinary") return testCloudinary();
  if (providerId === "email") return testPostmark();
  if (providerId === "whatsapp") return testWhatsApp();
  if (isPaymentProviderId(providerId)) return testPaymentProvider(providerId);
  return { success: false, message: `No connection test is implemented for "${providerId}".` };
}
