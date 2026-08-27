import type { Metadata } from "next";
import { LegalDocumentShell, LegalPendingNotice } from "@/components/LegalDocumentShell";

export const metadata: Metadata = {
  alternates: { canonical: "/refund-policy" },
  title: "Refund Policy · LearnSynaptic",
  description:
    "LearnSynaptic refund policy. Substantive policy text is pending legal review.",
  robots: { index: false, follow: true },
};

export default function RefundPolicyPage() {
  return (
    <LegalDocumentShell
      badge="Legal"
      title="Refund Policy"
      lead="Refund and cancellation terms for LearnSynaptic programs and platform billing."
    >
      <LegalPendingNotice documentLabel="Refund Policy" />
    </LegalDocumentShell>
  );
}
