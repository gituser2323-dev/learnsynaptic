import emailjs from "@emailjs/browser";
import {
  DATAANALYTICS_EMAILJS_PUBLIC_KEY,
  DATAANALYTICS_EMAILJS_SERVICE_ID,
  DATAANALYTICS_EMAILJS_TEMPLATE_ID,
} from "@/config/dataAnalyticsBi";
import { normalizeIndianMobile } from "./validation";

export interface DataAnalyticsRegistration {
  whatsappNumber: string;
  fullName: string;
}

export async function sendDataAnalyticsRegistration(data: DataAnalyticsRegistration) {
  return emailjs.send(
    DATAANALYTICS_EMAILJS_SERVICE_ID,
    DATAANALYTICS_EMAILJS_TEMPLATE_ID,
    {
      whatsapp_number: normalizeIndianMobile(data.whatsappNumber),
      full_name: data.fullName.trim() || "Not provided",
      program: "2-Hour Data Analytics & BI Masterclass",
      submittedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    },
    DATAANALYTICS_EMAILJS_PUBLIC_KEY,
  );
}
