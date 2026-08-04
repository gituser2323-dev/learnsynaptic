import { describe, it, expect } from "vitest";
import { validateCreateWorkflowDefinitionInput, validateWorkflowSteps } from "./validation";

/**
 * Module 3.2's own disclosed gap, closed as a fast-follow hardening
 * pass (implementation audit §7/§8): the API previously validated only
 * a step's top-level shape (id, action.type/condition.type membership,
 * delay/retry shape), never that e.g. `send_whatsapp_template.params.templateName`
 * was actually present — a direct API call bypassing
 * WorkflowStepBuilder.tsx's own client-side checks could persist a
 * structurally-invalid step that only failed later, at run time, inside
 * the executor. These tests protect the closed version of that gap.
 */

function baseInput(steps: unknown[]) {
  return { id: "unit-test-def", name: "Unit test", triggerEventType: "unit-test-trigger", active: true, steps };
}

describe("validateWorkflowSteps — per-action-type required params", () => {
  it.each([
    ["send_whatsapp_template", {}, "templateName"],
    ["send_whatsapp_template", { templateName: "  " }, "templateName"], // whitespace-only still counts as missing
    ["assign_lead", {}, "counsellorId"],
    ["add_tag", {}, "tagId"],
    ["create_task", { assigneeId: "user-1" }, "title"],
    ["create_task", { title: "Follow up" }, "assigneeId"],
    ["send_email", { body: "hi" }, "subject"],
    ["send_email", { subject: "hi" }, "body"],
  ])("rejects %s with missing/blank params (%o) — missing %s", (actionType, params, missingField) => {
    const result = validateWorkflowSteps([{ id: "s1", action: { type: actionType, params } }]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "steps[0].action.params" && e.message.includes(missingField))).toBe(true);
    }
  });

  it.each([
    ["send_whatsapp_template", { templateName: "welcome_v1" }],
    ["assign_lead", { counsellorId: "counsellor-1" }],
    ["add_tag", { tagId: "vip" }],
    ["create_task", { title: "Follow up", assigneeId: "user-1" }],
    ["send_email", { subject: "Welcome", body: "Thanks for your interest." }],
  ])("accepts %s with all required params present", (actionType, params) => {
    const result = validateWorkflowSteps([{ id: "s1", action: { type: actionType, params } }]);
    expect(result.valid).toBe(true);
  });

  it("accepts analyze_lead_ai with no params at all (Module 5.1 — nothing to configure)", () => {
    const result = validateWorkflowSteps([{ id: "s1", action: { type: "analyze_lead_ai", params: {} } }]);
    expect(result.valid).toBe(true);
  });

  it("still rejects an unrecognized action type, unchanged from before this pass", () => {
    const result = validateWorkflowSteps([{ id: "s1", action: { type: "not_a_real_action", params: {} } }]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === "steps[0].action.type")).toBe(true);
    }
  });

  it("reports every invalid step's params error, not just the first", () => {
    const result = validateWorkflowSteps([
      { id: "s1", action: { type: "add_tag", params: {} } },
      { id: "s2", action: { type: "create_task", params: {} } },
    ]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const fields = result.errors.map((e) => e.field);
      expect(fields).toContain("steps[0].action.params");
      expect(fields).toContain("steps[1].action.params");
    }
  });

  it("a create_task step missing both required params reports both, not just one", () => {
    const result = validateWorkflowSteps([{ id: "s1", action: { type: "create_task", params: {} } }]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const messages = result.errors.map((e) => e.message).join(" | ");
      expect(messages).toContain("title");
      expect(messages).toContain("assigneeId");
    }
  });

  it("flows through validateCreateWorkflowDefinitionInput end to end, matching the real API route's own entry point", () => {
    const rejected = validateCreateWorkflowDefinitionInput(
      baseInput([{ id: "s1", action: { type: "send_email", params: { subject: "hi" } } }]),
    );
    expect(rejected.valid).toBe(false);

    const accepted = validateCreateWorkflowDefinitionInput(
      baseInput([{ id: "s1", action: { type: "send_email", params: { subject: "hi", body: "there" } } }]),
    );
    expect(accepted.valid).toBe(true);
  });
});
