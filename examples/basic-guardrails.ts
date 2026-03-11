/**
 * Basic guardrails example — 3 tools with different levels.
 * Run: npx tsx examples/basic-guardrails.ts
 */

import { GuardrailMiddleware } from "../src/index.js";
import type { ToolDefinition } from "../src/index.js";

const tools: ToolDefinition[] = [
  {
    name: "read_data",
    execute: async (args) => ({ rows: 42, query: args.query }),
  },
  {
    name: "write_data",
    execute: async (args) => ({ written: true, record: args.record }),
  },
  {
    name: "delete_data",
    execute: async (args) => ({ deleted: true, id: args.id }),
  },
];

const middleware = new GuardrailMiddleware({
  rules: {
    read_data: "none",     // pass through — no logging
    write_data: "log",     // execute and log
    delete_data: "block",  // reject entirely
  },
});

// Listen for events
middleware.on("tool:executed", (e) => {
  console.log(`  [LOG] ${e.toolName} executed with args:`, e.args);
});
middleware.on("tool:blocked", (e) => {
  console.log(`  [BLOCKED] ${e.toolName} was blocked!`);
});

const wrapped = middleware.wrapAll(tools);

console.log("=== Tool Guardrails: Basic Example ===\n");

for (const tool of wrapped) {
  console.log(`Calling ${tool.name}...`);
  const result = await tool.execute({ query: "test", record: { a: 1 }, id: "rec-1" });
  console.log(`  Result:`, result);
  console.log();
}
