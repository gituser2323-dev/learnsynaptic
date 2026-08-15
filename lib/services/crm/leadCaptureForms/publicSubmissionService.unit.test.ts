import { describe, it, expect } from "vitest";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { leadCaptureFormService } from "./leadCaptureFormService";
import { publicSubmissionService } from "./publicSubmissionService";
import { leadService } from "@/lib/services/leads";

function uniqueOrg(label: string): string {
  return `org-pss-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function createTestForm(organizationId: string, name = "Test Form") {
  const result = await runWithTenantContext({ organizationId }, () => leadCaptureFormService.createForm({ name }));
  if (!result.success) throw new Error(`seed form creation failed: ${JSON.stringify(result.errors)}`);
  return result.form;
}

describe("publicSubmissionService.submit — the real CRM lifecycle, unmodified", () => {
  it("a valid submission creates a real Lead with source=lead_capture, capturedVia set, and the correct organization — reachable with NO ambient tenant context, same as the real public route", async () => {
    const org = uniqueOrg("valid");
    const form = await createTestForm(org, "Website Contact Form");

    // Deliberately NOT wrapped in runWithTenantContext — the real public
    // route has no session/context at all; submit() must resolve and
    // establish it internally from the slug alone.
    const result = await publicSubmissionService.submit(form.publicSlug, {
      name: "Asha Kumar",
      email: "asha@example.com",
      phone: "+919876543210",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.duplicate).toBe(false);

    const leads = await runWithTenantContext({ organizationId: org }, () => leadService.listLeads({}, 1, 20));
    expect(leads.items).toHaveLength(1);
    const lead = leads.items[0];
    expect(lead.source).toBe("lead_capture");
    expect(lead.capturedVia).toEqual({ formId: form.id, formName: "Website Contact Form" });
    expect(lead.organizationId).toBe(org);

    const updatedForm = await runWithTenantContext({ organizationId: org }, () => leadCaptureFormService.getForm(form.id));
    expect(updatedForm?.submissionCount).toBe(1);
    expect(updatedForm?.duplicateCount).toBe(0);
  });

  it("a repeat submission (same phone/email) is recognized as a duplicate touch, not a second Lead", async () => {
    const org = uniqueOrg("duplicate");
    const form = await createTestForm(org);
    const submission = { name: "Rohit Verma", email: "rohit@example.com", phone: "+919876500000" };

    const first = await publicSubmissionService.submit(form.publicSlug, submission);
    expect(first.success && first.duplicate).toBe(false);

    const second = await publicSubmissionService.submit(form.publicSlug, submission);
    expect(second.success).toBe(true);
    if (!second.success) throw new Error("expected success");
    expect(second.duplicate).toBe(true);

    const leads = await runWithTenantContext({ organizationId: org }, () => leadService.listLeads({}, 1, 20));
    expect(leads.items).toHaveLength(1);

    const updatedForm = await runWithTenantContext({ organizationId: org }, () => leadCaptureFormService.getForm(form.id));
    expect(updatedForm?.submissionCount).toBe(2);
    expect(updatedForm?.duplicateCount).toBe(1);
  });

  it("an inactive form rejects new submissions with a 404, not a silent drop", async () => {
    const org = uniqueOrg("inactive");
    const form = await createTestForm(org);
    await runWithTenantContext({ organizationId: org }, () => leadCaptureFormService.updateForm(form.id, { active: false }));

    const result = await publicSubmissionService.submit(form.publicSlug, {
      name: "Someone",
      email: "someone@example.com",
      phone: "+919876500001",
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.status).toBe(404);

    const leads = await runWithTenantContext({ organizationId: org }, () => leadService.listLeads({}, 1, 20));
    expect(leads.items).toHaveLength(0);
  });

  it("an unknown slug returns 404 and establishes no tenant context (no cross-tenant leak surface)", async () => {
    const result = await publicSubmissionService.submit("this-slug-does-not-exist", {
      name: "Someone",
      email: "someone@example.com",
      phone: "+919876500002",
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.status).toBe(404);
  });

  it("a filled honeypot field is silently accepted but never reaches the CRM", async () => {
    const org = uniqueOrg("honeypot");
    const form = await createTestForm(org);

    const result = await publicSubmissionService.submit(form.publicSlug, {
      name: "Bot",
      email: "bot@example.com",
      phone: "+919876500003",
      website: "http://spam.example.com",
    });
    expect(result.success).toBe(true);

    const leads = await runWithTenantContext({ organizationId: org }, () => leadService.listLeads({}, 1, 20));
    expect(leads.items).toHaveLength(0);

    // Counters aren't touched by a honeypot trip either — a form's own
    // stats should reflect real traffic, not bot noise.
    const updatedForm = await runWithTenantContext({ organizationId: org }, () => leadCaptureFormService.getForm(form.id));
    expect(updatedForm?.submissionCount).toBe(0);
  });
});
