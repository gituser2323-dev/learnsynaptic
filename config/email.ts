import emailjs from '@emailjs/browser';

export interface BootcampRegistration {
  name: string;
  email: string;
  phone: string;
  organisation: string;
  status: string;
  skillLevel: string;
  goal: string;
}

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!;
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_BOOTCAMP_TEMPLATE_ID!;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!;

export async function sendBootcampRegistration(data: BootcampRegistration) {
  return emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      name: data.name,
      email: data.email,
      phone: data.phone,
      organisation: data.organisation,
      status: data.status,
      skillLevel: data.skillLevel,
      goal: data.goal,
      program: 'FREE AI Full Stack + GenAI Bootcamp',
      submittedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    },
    PUBLIC_KEY,
  );
}
