import emailjs from "@emailjs/browser";
import {
  GENAI_EMAILJS_PUBLIC_KEY,
  GENAI_EMAILJS_SERVICE_ID,
  GENAI_EMAILJS_TEMPLATE_ID,
} from "@/config/genai";
import { normalizeIndianMobile } from "./validation";

export interface GenaiRegistration {
  whatsappNumber: string;
  fullName: string;
}

export async function sendGenaiRegistration(data: GenaiRegistration) {
  return emailjs.send(
    GENAI_EMAILJS_SERVICE_ID,
    GENAI_EMAILJS_TEMPLATE_ID,
    {
      whatsapp_number: normalizeIndianMobile(data.whatsappNumber),
      full_name: data.fullName.trim() || "Not provided",
      program: "2-Hour GenAI Masterclass",
      submittedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    },
    GENAI_EMAILJS_PUBLIC_KEY,
  );
}
