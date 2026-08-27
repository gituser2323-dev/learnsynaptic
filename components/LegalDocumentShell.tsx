import type { ReactNode } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";

/**
 * Shared chrome for /privacy, /terms, /refund-policy.
 * Placeholders only — do not invent legal policy claims here.
 * Replace body copy with counsel-approved content before Customer #1.
 */
export function LegalDocumentShell({
  badge,
  title,
  lead,
  children,
}: {
  badge: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <>
      <section
        className="pt-32 pb-14 lg:pt-40 lg:pb-16"
        style={{ background: "var(--ls-hero-bg)" }}
      >
        <div className="ls-container">
          <AnimateOnScroll>
            <span className="ls-badge mb-5 inline-flex">
              <FileText size={12} />
              {badge}
            </span>
            <h1 className="mb-5" style={{ maxWidth: 720 }}>
              {title}
            </h1>
            <p
              className="text-lg"
              style={{ color: "var(--ls-muted)", maxWidth: 560, lineHeight: 1.7 }}
            >
              {lead}
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      <section style={{ padding: "56px 0 80px" }}>
        <div className="ls-container" style={{ maxWidth: 720 }}>
          {children}
        </div>
      </section>

      <section style={{ background: "var(--ls-bg-alt)", padding: "48px 0" }}>
        <div className="ls-container">
          <p style={{ color: "var(--ls-muted)", lineHeight: 1.7, maxWidth: 560 }}>
            Questions about these policies?{" "}
            <Link
              href="/contact"
              style={{ color: "var(--ls-blue-primary)" }}
              className="hover:underline"
            >
              Contact us
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}

export function LegalPendingNotice({ documentLabel }: { documentLabel: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--ls-border)",
        background: "var(--ls-background-alt, #F8FAFC)",
        padding: "20px 24px",
        borderRadius: 8,
        lineHeight: 1.7,
        color: "var(--ls-text-primary)",
      }}
    >
      <p style={{ marginBottom: 12, fontWeight: 600 }}>
        {documentLabel} — content pending legal review
      </p>
      <p style={{ color: "var(--ls-muted)", marginBottom: 12 }}>
        This page exists so product links and signup consent destinations resolve
        correctly. The substantive policy text has not been finalized by counsel
        and must not be treated as an enforceable privacy, terms, or refund
        policy until approved copy is published here.
      </p>
      <p style={{ color: "var(--ls-muted)", margin: 0 }}>
        Last updated: pending. For interim questions, use{" "}
        <Link
          href="/contact"
          style={{ color: "var(--ls-blue-primary)" }}
          className="hover:underline"
        >
          Contact
        </Link>
        .
      </p>
    </div>
  );
}
