/**
 * Single source of truth for the /ai-bootcamp landing page's third-party
 * integration values. Never hardcode these inline in components — import
 * from here so rotating a key/template only requires one edit.
 */

export const AI_BOOTCAMP_EMAILJS_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!;
export const AI_BOOTCAMP_EMAILJS_SERVICE_ID =
  process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!;
export const AI_BOOTCAMP_EMAILJS_TEMPLATE_ID =
  process.env.NEXT_PUBLIC_EMAILJS_AI_BOOTCAMP_TEMPLATE_ID!;

// Real invite link confirmed by the client (2026-07-22).
export const AI_BOOTCAMP_WHATSAPP_COMMUNITY_URL =
  "https://chat.whatsapp.com/GYCiEA1Ld5A1h0n71QPFhG";
