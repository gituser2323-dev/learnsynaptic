/** Counsellor Assignment domain layer — Enterprise CRM (Phase 1). One
 *  active rule at a time (the simplest shape that satisfies "manual vs.
 *  round robin" — a full rule-matching engine with conditions is
 *  Automation Platform territory, explicitly out of scope here). */

export type AssignmentStrategy = "manual" | "round_robin";

export interface AssignmentRule {
  id: string;
  strategy: AssignmentStrategy;
  /** User ids eligible for round-robin selection; ignored for "manual". */
  counsellorIds: string[];
  active: boolean;
  /** Round-robin's own cursor — index into counsellorIds of the next
   *  counsellor to receive an assignment. Persisted so it survives a
   *  restart instead of resetting to always-counsellor-zero. */
  nextIndex: number;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssignmentRuleInput {
  strategy: AssignmentStrategy;
  counsellorIds: string[];
  organizationId?: string;
}

export interface AssignmentRuleRepository {
  getActive(): Promise<AssignmentRule | null>;
  create(input: CreateAssignmentRuleInput): Promise<AssignmentRule>;
  /** Atomically reads and advances the round-robin cursor, returning the
   *  counsellor id it pointed to *before* advancing — must be atomic at
   *  the storage layer (a mongo $inc, not read-then-write) so two
   *  concurrent lead creations can never receive the same cursor
   *  position (see the mongodb repository's own comment). */
  takeNextRoundRobinCounsellor(ruleId: string): Promise<string | null>;
}
