import type { Metadata } from "next";
import { LegalDocumentShell, LegalPendingNotice } from "@/components/LegalDocumentShell";

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  title: "Terms of Use · LearnSynaptic",
  description:
    "LearnSynaptic terms of use. Substantive terms text is pending legal review.",
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <LegalDocumentShell
      badge="Legal"
      title="Terms of Use"
      lead="The terms that govern use of LearnSynaptic products and this website."
    >
      <LegalPendingNotice documentLabel="Terms of Use" />
    </LegalDocumentShell>
  );
}
