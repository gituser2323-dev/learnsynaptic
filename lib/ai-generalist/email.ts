import emailjs from "@emailjs/browser";
import {
  AI_BOOTCAMP_EMAILJS_PUBLIC_KEY,
  AI_BOOTCAMP_EMAILJS_SERVICE_ID,
  AI_BOOTCAMP_EMAILJS_TEMPLATE_ID,
} from "@/config/aiBootcamp";
import { normalizeIndianMobile } from "./validation";

export interface AiGeneralistRegistration {
  whatsappNumber: string;
  fullName: string;
}

/** Reuses the /ai-bootcamp EmailJS service + template (shared account, per
 *  the client's decision) — the "program" field distinguishes submissions
 *  from this cohort in the inbox/CRM. */
export async function sendAiGeneralistRegistration(data: AiGeneralistRegistration) {
  return emailjs.send(
    AI_BOOTCAMP_EMAILJS_SERVICE_ID,
    AI_BOOTCAMP_EMAILJS_TEMPLATE_ID,
    {
      whatsapp_number: normalizeIndianMobile(data.whatsappNumber),
      full_name: data.fullName.trim() || "Not provided",
      program: "AI for Business Bootcamp",
      submittedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    },
    AI_BOOTCAMP_EMAILJS_PUBLIC_KEY,
  );
}
