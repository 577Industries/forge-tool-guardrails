/**
 * GuardrailMiddleware — wraps tools with 4-level guardrail enforcement.
 *
 * Levels:
 * - none:  pass through without any logging
 * - log:   execute the tool and emit an event
 * - pause: create a pending operation for human approval
 * - block: reject the tool call entirely
 *
 * Adapted from FORGE OS agent runtime guardrail system.
 */

import { EventEmitter } from "node:events";
import type {
  GuardrailLevel,
  GuardrailConfig,
  ToolDefinition,
  PendingOperationStore,
} from "./types.js";
import { InMemoryOperationStore } from "./operations.js";
import { GUARDRAIL_EVENTS } from "./events.js";

export class GuardrailMiddleware extends EventEmitter {
  private rules: Record<string, GuardrailLevel>;
  private defaultLevel: GuardrailLevel;
  private operationStore: PendingOperationStore;

  constructor(config: GuardrailConfig) {
    super();
    this.rules = config.rules;
    this.defaultLevel = config.defaultLevel ?? "log";
    this.operationStore =
      config.operationStore ??
      new InMemoryOperationStore(config.expirationMs);
  }

  /**
   * Get the effective guardrail level for a tool.
   * Per-tool rule takes precedence over default.
   */
  getLevel(toolName: string): GuardrailLevel {
    return this.rules[toolName] ?? this.defaultLevel;
  }

  /**
   * Wrap a single tool with guardrail enforcement.
   */
  wrap(tool: ToolDefinition): ToolDefinition {
    const level = this.getLevel(tool.name);

    if (level === "none") {
      return tool;
    }

    return {
      name: tool.name,
      execute: async (args: Record<string, unknown>) => {
        if (level === "block") {
          const event = { toolName: tool.name, args, level };
          this.emit(GUARDRAIL_EVENTS.TOOL_BLOCKED, event);
          return {
            success: false,
            blocked: true,
            message: `Tool "${tool.name}" is blocked by guardrail configuration`,
          };
        }

        if (level === "pause") {
          const op = await this.operationStore.create({
            toolName: tool.name,
            toolInput: args,
          });
          const event = {
            toolName: tool.name,
            args,
            level,
            operationId: op.id,
          };
          this.emit(GUARDRAIL_EVENTS.TOOL_PAUSED, event);
          return {
            success: false,
            paused: true,
            operationId: op.id,
            message: `Tool "${tool.name}" requires approval (operation ${op.id.slice(0, 8)}...)`,
          };
        }

        // level === "log" — execute and emit event
        const result = await tool.execute(args);
        const event = { toolName: tool.name, args, level, result };
        this.emit(GUARDRAIL_EVENTS.TOOL_EXECUTED, event);
        return result;
      },
    };
  }

  /**
   * Wrap multiple tools with guardrail enforcement.
   */
  wrapAll(tools: ToolDefinition[]): ToolDefinition[] {
    return tools.map((t) => this.wrap(t));
  }

  /**
   * Get the pending operation store for approval management.
   */
  getOperationStore(): PendingOperationStore {
    return this.operationStore;
  }

  /**
   * Approve a pending operation by ID.
   */
  async approve(operationId: string, approvedBy: string) {
    const op = await this.operationStore.approve(operationId, approvedBy);
    this.emit(GUARDRAIL_EVENTS.OPERATION_APPROVED, {
      operationId,
      approvedBy,
    });
    return op;
  }

  /**
   * Reject a pending operation by ID.
   */
  async reject(operationId: string, rejectedBy: string) {
    const op = await this.operationStore.reject(operationId, rejectedBy);
    this.emit(GUARDRAIL_EVENTS.OPERATION_REJECTED, {
      operationId,
      rejectedBy,
    });
    return op;
  }

  /**
   * Expire all stale pending operations.
   */
  async expireStale() {
    const expired = await this.operationStore.expireStale();
    for (const op of expired) {
      this.emit(GUARDRAIL_EVENTS.OPERATION_EXPIRED, {
        operationId: op.id,
      });
    }
    return expired;
  }
}
