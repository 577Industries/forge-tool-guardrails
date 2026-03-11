/**
 * In-memory pending operation store.
 * Manages the approve/reject/expire lifecycle for paused tool executions.
 */

import crypto from "node:crypto";
import type { PendingOperation, PendingOperationStore } from "./types.js";

export class InMemoryOperationStore implements PendingOperationStore {
  private operations = new Map<string, PendingOperation>();
  private expirationMs: number;

  constructor(expirationMs = 3_600_000) {
    this.expirationMs = expirationMs;
  }

  async create(op: {
    toolName: string;
    toolInput: Record<string, unknown>;
  }): Promise<PendingOperation> {
    const now = new Date();
    const operation: PendingOperation = {
      id: crypto.randomUUID(),
      toolName: op.toolName,
      toolInput: op.toolInput,
      status: "pending",
      requestedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.expirationMs).toISOString(),
    };
    this.operations.set(operation.id, operation);
    return operation;
  }

  async get(id: string): Promise<PendingOperation | null> {
    return this.operations.get(id) ?? null;
  }

  async approve(id: string, approvedBy: string): Promise<PendingOperation> {
    const op = this.operations.get(id);
    if (!op) throw new Error(`Operation ${id} not found`);
    if (op.status !== "pending") {
      throw new Error(`Operation ${id} is already ${op.status}`);
    }
    op.status = "approved";
    op.resolvedAt = new Date().toISOString();
    op.resolvedBy = approvedBy;
    return op;
  }

  async reject(id: string, rejectedBy: string): Promise<PendingOperation> {
    const op = this.operations.get(id);
    if (!op) throw new Error(`Operation ${id} not found`);
    if (op.status !== "pending") {
      throw new Error(`Operation ${id} is already ${op.status}`);
    }
    op.status = "rejected";
    op.resolvedAt = new Date().toISOString();
    op.resolvedBy = rejectedBy;
    return op;
  }

  async expire(id: string): Promise<PendingOperation> {
    const op = this.operations.get(id);
    if (!op) throw new Error(`Operation ${id} not found`);
    op.status = "expired";
    op.resolvedAt = new Date().toISOString();
    return op;
  }

  async listPending(): Promise<PendingOperation[]> {
    return [...this.operations.values()].filter(
      (op) => op.status === "pending"
    );
  }

  async expireStale(): Promise<PendingOperation[]> {
    const now = Date.now();
    const expired: PendingOperation[] = [];

    for (const op of this.operations.values()) {
      if (op.status === "pending" && new Date(op.expiresAt).getTime() <= now) {
        op.status = "expired";
        op.resolvedAt = new Date().toISOString();
        expired.push(op);
      }
    }

    return expired;
  }
}
