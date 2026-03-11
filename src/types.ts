/**
 * Type definitions for tool-guardrails.
 */

export type GuardrailLevel = "none" | "log" | "pause" | "block";

export interface ToolDefinition {
  name: string;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface GuardrailConfig {
  rules: Record<string, GuardrailLevel>;
  defaultLevel?: GuardrailLevel;
  operationStore?: PendingOperationStore;
  expirationMs?: number;
}

export interface PendingOperation {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  expiresAt: string;
}

export interface PendingOperationStore {
  create(op: {
    toolName: string;
    toolInput: Record<string, unknown>;
  }): Promise<PendingOperation>;
  get(id: string): Promise<PendingOperation | null>;
  approve(id: string, approvedBy: string): Promise<PendingOperation>;
  reject(id: string, rejectedBy: string): Promise<PendingOperation>;
  expire(id: string): Promise<PendingOperation>;
  listPending(): Promise<PendingOperation[]>;
  expireStale(): Promise<PendingOperation[]>;
}

export interface GuardrailEvent {
  toolName: string;
  args: Record<string, unknown>;
  level: GuardrailLevel;
  result?: unknown;
  operationId?: string;
}
