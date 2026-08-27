import type { Metadata } from "next";
import { LegalDocumentShell, LegalPendingNotice } from "@/components/LegalDocumentShell";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  title: "Privacy Policy · LearnSynaptic",
  description:
    "LearnSynaptic privacy policy. Substantive policy text is pending legal review.",
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalDocumentShell
      badge="Legal"
      title="Privacy Policy"
      lead="How LearnSynaptic handles personal data for this product and marketing site."
    >
      <LegalPendingNotice documentLabel="Privacy Policy" />
    </LegalDocumentShell>
  );
}
