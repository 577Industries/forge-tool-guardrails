import { describe, it, expect, vi } from "vitest";
import { GuardrailMiddleware } from "../src/middleware.js";
import type { ToolDefinition } from "../src/types.js";

function makeTool(name: string, returnValue: unknown = { ok: true }): ToolDefinition {
  return {
    name,
    execute: vi.fn().mockResolvedValue(returnValue),
  };
}

describe("GuardrailMiddleware", () => {
  it('"none" level passes through unchanged', async () => {
    const mw = new GuardrailMiddleware({ rules: { read: "none" } });
    const tool = makeTool("read");
    const wrapped = mw.wrap(tool);

    const result = await wrapped.execute({ query: "test" });

    expect(result).toEqual({ ok: true });
    expect(tool.execute).toHaveBeenCalledWith({ query: "test" });
  });

  it('"log" level executes and emits event', async () => {
    const mw = new GuardrailMiddleware({ rules: { write: "log" } });
    const tool = makeTool("write", { written: true });
    const wrapped = mw.wrap(tool);

    const events: unknown[] = [];
    mw.on("tool:executed", (e) => events.push(e));

    const result = await wrapped.execute({ data: "hello" });

    expect(result).toEqual({ written: true });
    expect(tool.execute).toHaveBeenCalled();
    expect(events).toHaveLength(1);
  });

  it('"block" level returns blocked result without executing', async () => {
    const mw = new GuardrailMiddleware({ rules: { destroy: "block" } });
    const tool = makeTool("destroy");
    const wrapped = mw.wrap(tool);

    const events: unknown[] = [];
    mw.on("tool:blocked", (e) => events.push(e));

    const result = await wrapped.execute({ id: "123" }) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(result.blocked).toBe(true);
    expect(tool.execute).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
  });

  it('"pause" level creates pending operation', async () => {
    const mw = new GuardrailMiddleware({ rules: { deploy: "pause" } });
    const tool = makeTool("deploy");
    const wrapped = mw.wrap(tool);

    const events: unknown[] = [];
    mw.on("tool:paused", (e) => events.push(e));

    const result = await wrapped.execute({ target: "prod" }) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect(result.paused).toBe(true);
    expect(result.operationId).toBeDefined();
    expect(tool.execute).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
  });

  it("default level applies when no per-tool rule exists", async () => {
    const mw = new GuardrailMiddleware({
      rules: {},
      defaultLevel: "block",
    });
    const tool = makeTool("anything");
    const wrapped = mw.wrap(tool);

    const result = await wrapped.execute({}) as Record<string, unknown>;
    expect(result.blocked).toBe(true);
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it("per-tool rule overrides default", () => {
    const mw = new GuardrailMiddleware({
      rules: { special: "none" },
      defaultLevel: "block",
    });

    expect(mw.getLevel("special")).toBe("none");
    expect(mw.getLevel("other")).toBe("block");
  });

  it("wrapping preserves tool name", () => {
    const mw = new GuardrailMiddleware({ rules: { myTool: "log" } });
    const tool = makeTool("myTool");
    const wrapped = mw.wrap(tool);

    expect(wrapped.name).toBe("myTool");
  });

  it("wrapAll wraps multiple tools", async () => {
    const mw = new GuardrailMiddleware({
      rules: { a: "none", b: "block" },
    });

    const tools = [makeTool("a"), makeTool("b")];
    const wrapped = mw.wrapAll(tools);

    expect(wrapped).toHaveLength(2);
    expect(wrapped[0].name).toBe("a");
    expect(wrapped[1].name).toBe("b");

    await wrapped[0].execute({});
    expect(tools[0].execute).toHaveBeenCalled();

    const result = await wrapped[1].execute({}) as Record<string, unknown>;
    expect(result.blocked).toBe(true);
    expect(tools[1].execute).not.toHaveBeenCalled();
  });

  it("defaults to log when no default specified", () => {
    const mw = new GuardrailMiddleware({ rules: {} });
    expect(mw.getLevel("unknown")).toBe("log");
  });
});
