import type { WorkflowContext } from "../types";

/** Resolves one WorkflowActionSpec.params against a live WorkflowContext
 *  and performs the action — throwing is exactly how engine.ts already
 *  decides a step failed (see engine.ts's advanceWorkflowRun), so an
 *  executor throwing is the correct, expected way to report failure;
 *  there is no separate result type. */
export type WorkflowActionExecutor = (context: WorkflowContext, params: Record<string, unknown>) => Promise<void>;
