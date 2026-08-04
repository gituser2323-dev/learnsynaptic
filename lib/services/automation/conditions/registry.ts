import type { WorkflowConditionType } from "../types";
import type { WorkflowConditionEvaluator } from "./types";
import { leadNotRegistered } from "./executors/leadNotRegistered";

const conditionRegistry: Record<WorkflowConditionType, WorkflowConditionEvaluator> = {
  lead_not_registered: leadNotRegistered,
};

export function getConditionEvaluator(type: WorkflowConditionType): WorkflowConditionEvaluator {
  const evaluator = conditionRegistry[type];
  if (!evaluator) throw new Error(`Unknown workflow condition type: ${type}`);
  return evaluator;
}
