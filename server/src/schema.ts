import { z } from 'zod';

// Agent schema
export const agentSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  role: z.string(),
  goal: z.string(),
  backstory: z.string(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Agent = z.infer<typeof agentSchema>;

// Agent run schema
export const agentRunSchema = z.object({
  id: z.number(),
  agent_id: z.number(),
  input_text: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  started_at: z.coerce.date().nullable(),
  completed_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type AgentRun = z.infer<typeof agentRunSchema>;

// Agent output schema for streaming logs and results
export const agentOutputSchema = z.object({
  id: z.number(),
  run_id: z.number(),
  output_type: z.enum(['log', 'result', 'error']),
  content: z.string(),
  timestamp: z.coerce.date(),
  created_at: z.coerce.date()
});

export type AgentOutput = z.infer<typeof agentOutputSchema>;

// Input schema for creating agents
export const createAgentInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  role: z.string().min(1),
  goal: z.string().min(1),
  backstory: z.string().min(1),
  is_active: z.boolean().default(true)
});

export type CreateAgentInput = z.infer<typeof createAgentInputSchema>;

// Input schema for updating agents
export const updateAgentInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  role: z.string().min(1).optional(),
  goal: z.string().min(1).optional(),
  backstory: z.string().min(1).optional(),
  is_active: z.boolean().optional()
});

export type UpdateAgentInput = z.infer<typeof updateAgentInputSchema>;

// Input schema for starting agent runs
export const startAgentRunInputSchema = z.object({
  agent_id: z.number(),
  input_text: z.string().min(1)
});

export type StartAgentRunInput = z.infer<typeof startAgentRunInputSchema>;

// Input schema for updating agent run status
export const updateAgentRunInputSchema = z.object({
  id: z.number(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  started_at: z.coerce.date().nullable().optional(),
  completed_at: z.coerce.date().nullable().optional()
});

export type UpdateAgentRunInput = z.infer<typeof updateAgentRunInputSchema>;

// Input schema for creating agent output
export const createAgentOutputInputSchema = z.object({
  run_id: z.number(),
  output_type: z.enum(['log', 'result', 'error']),
  content: z.string(),
  timestamp: z.coerce.date().optional() // Optional, will default to now if not provided
});

export type CreateAgentOutputInput = z.infer<typeof createAgentOutputInputSchema>;

// Schema for getting agent run with outputs
export const agentRunWithOutputsSchema = agentRunSchema.extend({
  outputs: z.array(agentOutputSchema)
});

export type AgentRunWithOutputs = z.infer<typeof agentRunWithOutputsSchema>;

// Schema for streaming output events
export const streamOutputEventSchema = z.object({
  type: z.enum(['output', 'status_update', 'complete']),
  run_id: z.number(),
  data: z.union([
    agentOutputSchema,
    z.object({ status: z.enum(['pending', 'running', 'completed', 'failed']) }),
    z.object({ final_result: z.string().optional() })
  ])
});

export type StreamOutputEvent = z.infer<typeof streamOutputEventSchema>;