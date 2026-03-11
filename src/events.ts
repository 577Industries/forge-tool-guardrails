/**
 * Event types emitted by GuardrailMiddleware.
 */

export const GUARDRAIL_EVENTS = {
  TOOL_EXECUTED: "tool:executed",
  TOOL_BLOCKED: "tool:blocked",
  TOOL_PAUSED: "tool:paused",
  OPERATION_APPROVED: "operation:approved",
  OPERATION_REJECTED: "operation:rejected",
  OPERATION_EXPIRED: "operation:expired",
} as const;

export type GuardrailEventType =
  (typeof GUARDRAIL_EVENTS)[keyof typeof GUARDRAIL_EVENTS];
