import { serial, text, pgTable, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const runStatusEnum = pgEnum('run_status', ['pending', 'running', 'completed', 'failed']);
export const outputTypeEnum = pgEnum('output_type', ['log', 'result', 'error']);

// Agents table
export const agentsTable = pgTable('agents', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Nullable by default
  role: text('role').notNull(),
  goal: text('goal').notNull(),
  backstory: text('backstory').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Agent runs table
export const agentRunsTable = pgTable('agent_runs', {
  id: serial('id').primaryKey(),
  agent_id: integer('agent_id').notNull().references(() => agentsTable.id),
  input_text: text('input_text').notNull(),
  status: runStatusEnum('status').notNull().default('pending'),
  started_at: timestamp('started_at'), // Nullable - set when run actually starts
  completed_at: timestamp('completed_at'), // Nullable - set when run completes
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Agent outputs table for streaming logs and results
export const agentOutputsTable = pgTable('agent_outputs', {
  id: serial('id').primaryKey(),
  run_id: integer('run_id').notNull().references(() => agentRunsTable.id),
  output_type: outputTypeEnum('output_type').notNull(),
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const agentsRelations = relations(agentsTable, ({ many }) => ({
  runs: many(agentRunsTable)
}));

export const agentRunsRelations = relations(agentRunsTable, ({ one, many }) => ({
  agent: one(agentsTable, {
    fields: [agentRunsTable.agent_id],
    references: [agentsTable.id]
  }),
  outputs: many(agentOutputsTable)
}));

export const agentOutputsRelations = relations(agentOutputsTable, ({ one }) => ({
  run: one(agentRunsTable, {
    fields: [agentOutputsTable.run_id],
    references: [agentRunsTable.id]
  })
}));

// TypeScript types for the table schemas
export type Agent = typeof agentsTable.$inferSelect;
export type NewAgent = typeof agentsTable.$inferInsert;
export type AgentRun = typeof agentRunsTable.$inferSelect;
export type NewAgentRun = typeof agentRunsTable.$inferInsert;
export type AgentOutput = typeof agentOutputsTable.$inferSelect;
export type NewAgentOutput = typeof agentOutputsTable.$inferInsert;

// Export all tables for proper query building
export const tables = { 
  agents: agentsTable, 
  agentRuns: agentRunsTable,
  agentOutputs: agentOutputsTable
};