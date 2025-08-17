import { db } from '../db';
import { agentRunsTable, agentsTable } from '../db/schema';
import { type StartAgentRunInput, type AgentRun } from '../schema';
import { eq } from 'drizzle-orm';

export const startAgentRun = async (input: StartAgentRunInput): Promise<AgentRun> => {
  try {
    // Verify that the agent exists and is active
    const agent = await db.select()
      .from(agentsTable)
      .where(eq(agentsTable.id, input.agent_id))
      .execute();

    if (agent.length === 0) {
      throw new Error(`Agent with id ${input.agent_id} not found`);
    }

    if (!agent[0].is_active) {
      throw new Error(`Agent with id ${input.agent_id} is not active`);
    }

    // Create new agent run record
    const result = await db.insert(agentRunsTable)
      .values({
        agent_id: input.agent_id,
        input_text: input.input_text,
        status: 'pending' // Start with pending status
        // started_at and completed_at remain null until agent actually starts/completes
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Agent run creation failed:', error);
    throw error;
  }
};