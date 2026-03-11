/**
 * Approval flow example — pause, review, approve/reject.
 * Run: npx tsx examples/approval-flow.ts
 */

import { GuardrailMiddleware } from "../src/index.js";
import type { ToolDefinition } from "../src/index.js";

const deployTool: ToolDefinition = {
  name: "deploy_to_production",
  execute: async (args) => ({
    deployed: true,
    environment: args.env,
    version: args.version,
  }),
};

const middleware = new GuardrailMiddleware({
  rules: {
    deploy_to_production: "pause",
  },
});

middleware.on("tool:paused", (e) => {
  console.log(`  [PAUSED] ${e.toolName} — operation ${e.operationId.slice(0, 8)}...`);
});
middleware.on("operation:approved", (e) => {
  console.log(`  [APPROVED] by ${e.approvedBy}`);
});
middleware.on("operation:rejected", (e) => {
  console.log(`  [REJECTED] by ${e.rejectedBy}`);
});

console.log("=== Tool Guardrails: Approval Flow ===\n");

const wrapped = middleware.wrap(deployTool);

// Step 1: Tool call gets paused
console.log("1. Calling deploy_to_production...");
const result = await wrapped.execute({ env: "production", version: "2.1.0" }) as Record<string, unknown>;
console.log(`   Status: paused (operation ${(result.operationId as string).slice(0, 8)}...)\n`);

// Step 2: List pending operations
const store = middleware.getOperationStore();
const pending = await store.listPending();
console.log(`2. Pending operations: ${pending.length}`);
for (const op of pending) {
  console.log(`   - ${op.toolName}: ${JSON.stringify(op.toolInput)}`);
}

// Step 3: Approve the operation
console.log("\n3. Approving operation...");
const approved = await middleware.approve(result.operationId as string, "tech-lead");
console.log(`   Operation status: ${approved.status}`);

// Step 4: Verify no more pending
const remaining = await store.listPending();
console.log(`\n4. Remaining pending: ${remaining.length}`);
