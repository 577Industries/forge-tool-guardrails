import { describe, it, expect, vi } from "vitest";
import { GuardrailMiddleware } from "../src/middleware.js";
import { GUARDRAIL_EVENTS } from "../src/events.js";
import type { ToolDefinition } from "../src/types.js";

function makeTool(name: string): ToolDefinition {
  return { name, execute: vi.fn().mockResolvedValue({ ok: true }) };
}

describe("event emission", () => {
  it('emits "tool:executed" on log level', async () => {
    const mw = new GuardrailMiddleware({ rules: { read: "log" } });
    const handler = vi.fn();
    mw.on(GUARDRAIL_EVENTS.TOOL_EXECUTED, handler);

    const wrapped = mw.wrap(makeTool("read"));
    await wrapped.execute({ q: "test" });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].toolName).toBe("read");
    expect(handler.mock.calls[0][0].result).toEqual({ ok: true });
  });

  it('emits "tool:blocked" on block level', async () => {
    const mw = new GuardrailMiddleware({ rules: { delete: "block" } });
    const handler = vi.fn();
    mw.on(GUARDRAIL_EVENTS.TOOL_BLOCKED, handler);

    const wrapped = mw.wrap(makeTool("delete"));
    await wrapped.execute({ id: "123" });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].toolName).toBe("delete");
  });

  it('emits "tool:paused" on pause level', async () => {
    const mw = new GuardrailMiddleware({ rules: { deploy: "pause" } });
    const handler = vi.fn();
    mw.on(GUARDRAIL_EVENTS.TOOL_PAUSED, handler);

    const wrapped = mw.wrap(makeTool("deploy"));
    await wrapped.execute({ env: "prod" });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].operationId).toBeDefined();
  });

  it('emits "operation:approved" on approval', async () => {
    const mw = new GuardrailMiddleware({ rules: { deploy: "pause" } });
    const handler = vi.fn();
    mw.on(GUARDRAIL_EVENTS.OPERATION_APPROVED, handler);

    const wrapped = mw.wrap(makeTool("deploy"));
    const result = await wrapped.execute({}) as Record<string, unknown>;
    await mw.approve(result.operationId as string, "admin");

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].approvedBy).toBe("admin");
  });

  it('emits "operation:rejected" on rejection', async () => {
    const mw = new GuardrailMiddleware({ rules: { deploy: "pause" } });
    const handler = vi.fn();
    mw.on(GUARDRAIL_EVENTS.OPERATION_REJECTED, handler);

    const wrapped = mw.wrap(makeTool("deploy"));
    const result = await wrapped.execute({}) as Record<string, unknown>;
    await mw.reject(result.operationId as string, "security");

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].rejectedBy).toBe("security");
  });

  it('emits "operation:expired" on expiration', async () => {
    const mw = new GuardrailMiddleware({
      rules: { deploy: "pause" },
      expirationMs: 1,
    });
    const handler = vi.fn();
    mw.on(GUARDRAIL_EVENTS.OPERATION_EXPIRED, handler);

    const wrapped = mw.wrap(makeTool("deploy"));
    await wrapped.execute({});

    await new Promise((r) => setTimeout(r, 10));
    await mw.expireStale();

    expect(handler).toHaveBeenCalledOnce();
  });
});
