import emailjs from "@emailjs/browser";
import {
  AI_BOOTCAMP_EMAILJS_PUBLIC_KEY,
  AI_BOOTCAMP_EMAILJS_SERVICE_ID,
  AI_BOOTCAMP_EMAILJS_TEMPLATE_ID,
} from "@/config/aiBootcamp";
import { normalizeIndianMobile } from "./validation";

export interface AiBootcampRegistration {
  whatsappNumber: string;
  fullName: string;
}

export async function sendAiBootcampRegistration(data: AiBootcampRegistration) {
  return emailjs.send(
    AI_BOOTCAMP_EMAILJS_SERVICE_ID,
    AI_BOOTCAMP_EMAILJS_TEMPLATE_ID,
    {
      whatsapp_number: normalizeIndianMobile(data.whatsappNumber),
      full_name: data.fullName.trim() || "Not provided",
      program: "7-Day AI Engineering Bootcamp",
      submittedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    },
    AI_BOOTCAMP_EMAILJS_PUBLIC_KEY,
  );
}
