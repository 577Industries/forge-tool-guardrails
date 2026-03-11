import { describe, it, expect } from "vitest";
import { InMemoryOperationStore } from "../src/operations.js";

describe("InMemoryOperationStore", () => {
  it("creates a pending operation with correct fields", async () => {
    const store = new InMemoryOperationStore();
    const op = await store.create({
      toolName: "deploy",
      toolInput: { target: "prod" },
    });

    expect(op.id).toBeDefined();
    expect(op.toolName).toBe("deploy");
    expect(op.toolInput).toEqual({ target: "prod" });
    expect(op.status).toBe("pending");
    expect(op.requestedAt).toBeDefined();
    expect(op.expiresAt).toBeDefined();
  });

  it("generates unique IDs", async () => {
    const store = new InMemoryOperationStore();
    const op1 = await store.create({ toolName: "a", toolInput: {} });
    const op2 = await store.create({ toolName: "b", toolInput: {} });

    expect(op1.id).not.toBe(op2.id);
  });

  it("approves a pending operation", async () => {
    const store = new InMemoryOperationStore();
    const op = await store.create({ toolName: "deploy", toolInput: {} });

    const approved = await store.approve(op.id, "admin");

    expect(approved.status).toBe("approved");
    expect(approved.resolvedBy).toBe("admin");
    expect(approved.resolvedAt).toBeDefined();
  });

  it("rejects a pending operation", async () => {
    const store = new InMemoryOperationStore();
    const op = await store.create({ toolName: "deploy", toolInput: {} });

    const rejected = await store.reject(op.id, "security-team");

    expect(rejected.status).toBe("rejected");
    expect(rejected.resolvedBy).toBe("security-team");
  });

  it("throws when approving already-resolved operation", async () => {
    const store = new InMemoryOperationStore();
    const op = await store.create({ toolName: "deploy", toolInput: {} });
    await store.approve(op.id, "admin");

    await expect(store.approve(op.id, "admin")).rejects.toThrow("already approved");
  });

  it("throws when rejecting already-resolved operation", async () => {
    const store = new InMemoryOperationStore();
    const op = await store.create({ toolName: "deploy", toolInput: {} });
    await store.reject(op.id, "admin");

    await expect(store.reject(op.id, "admin")).rejects.toThrow("already rejected");
  });

  it("expires a pending operation", async () => {
    const store = new InMemoryOperationStore();
    const op = await store.create({ toolName: "deploy", toolInput: {} });

    const expired = await store.expire(op.id);
    expect(expired.status).toBe("expired");
  });

  it("lists only pending operations", async () => {
    const store = new InMemoryOperationStore();
    await store.create({ toolName: "a", toolInput: {} });
    const op2 = await store.create({ toolName: "b", toolInput: {} });
    await store.create({ toolName: "c", toolInput: {} });
    await store.approve(op2.id, "admin");

    const pending = await store.listPending();
    expect(pending).toHaveLength(2);
    expect(pending.every((p) => p.status === "pending")).toBe(true);
  });

  it("expireStale expires operations past expiresAt", async () => {
    // Create store with 1ms expiration for instant expiry
    const store = new InMemoryOperationStore(1);
    await store.create({ toolName: "fast", toolInput: {} });

    // Wait for expiration
    await new Promise((r) => setTimeout(r, 10));

    const expired = await store.expireStale();
    expect(expired).toHaveLength(1);
    expect(expired[0].status).toBe("expired");
  });

  it("retrieves an operation by ID", async () => {
    const store = new InMemoryOperationStore();
    const created = await store.create({ toolName: "test", toolInput: { x: 1 } });

    const retrieved = await store.get(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.toolName).toBe("test");
  });

  it("returns null for unknown ID", async () => {
    const store = new InMemoryOperationStore();
    const result = await store.get("nonexistent");
    expect(result).toBeNull();
  });
});
