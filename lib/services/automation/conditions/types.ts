import type { WorkflowContext } from "../types";

/** Resolves one WorkflowConditionSpec.params against a live
 *  WorkflowContext. False means "skip this step" — not a failure, not
 *  retried — exactly WorkflowStepCondition.evaluate()'s existing
 *  contract in engine.ts. */
export type WorkflowConditionEvaluator = (context: WorkflowContext, params: Record<string, unknown>) => Promise<boolean>;
