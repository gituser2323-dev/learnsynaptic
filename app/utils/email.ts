import emailjs from "@emailjs/browser";

interface LeadData {
  name: string;
  phone: string;
  email: string;
  program: string;
  source?: string;
}

export async function sendLeadEmail(data: LeadData) {
  return emailjs.send(
    process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
    process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
    {
      name: data.name,
      phone: data.phone,
      email: data.email,
      program: data.program,
      source: data.source || "Website",
      submittedAt: new Date().toLocaleString(),
    },
    process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
  );
}