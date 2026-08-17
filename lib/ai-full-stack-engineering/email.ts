import emailjs from "@emailjs/browser";
import {
  AI_FULLSTACK_EMAILJS_PUBLIC_KEY,
  AI_FULLSTACK_EMAILJS_SERVICE_ID,
  AI_FULLSTACK_EMAILJS_TEMPLATE_ID,
} from "@/config/aiFullStackEngineering";
import { normalizeIndianMobile } from "./validation";

export interface AiFullStackRegistration {
  whatsappNumber: string;
  fullName: string;
}

export async function sendAiFullStackRegistration(data: AiFullStackRegistration) {
  return emailjs.send(
    AI_FULLSTACK_EMAILJS_SERVICE_ID,
    AI_FULLSTACK_EMAILJS_TEMPLATE_ID,
    {
      whatsapp_number: normalizeIndianMobile(data.whatsappNumber),
      full_name: data.fullName.trim() || "Not provided",
      program: "2-Hour AI Full Stack Engineering Masterclass",
      submittedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    },
    AI_FULLSTACK_EMAILJS_PUBLIC_KEY,
  );
}
