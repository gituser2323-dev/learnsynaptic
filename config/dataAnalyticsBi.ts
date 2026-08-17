/**
 * Single source of truth for the /data-analytics-bi landing page's third-party
 * integration values. Never hardcode these inline in components — import
 * from here so rotating a key/template only requires one edit.
 */

export const DATAANALYTICS_EMAILJS_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!;
export const DATAANALYTICS_EMAILJS_SERVICE_ID =
  process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!;
// No dedicated EmailJS template is provisioned for this route yet — reuses
// the shared /ai-bootcamp template (same underlying account); the `program`
// field in the payload is what tells the two funnels apart downstream.
export const DATAANALYTICS_EMAILJS_TEMPLATE_ID =
  process.env.NEXT_PUBLIC_EMAILJS_AI_BOOTCAMP_TEMPLATE_ID!;

// Real invite link confirmed by the client (2026-07-22).
export const DATAANALYTICS_WHATSAPP_COMMUNITY_URL =
  "https://chat.whatsapp.com/GYCiEA1Ld5A1h0n71QPFhG";

// The next live session date/time is computed live (alternating Thursday
// 8:00 PM / Sunday 11:00 AM IST) by lib/masterclassSchedule.ts — nothing
// to configure here.
