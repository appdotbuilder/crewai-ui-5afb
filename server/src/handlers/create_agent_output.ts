import { db } from '../db';
import { agentOutputsTable, agentRunsTable } from '../db/schema';
import { type CreateAgentOutputInput, type AgentOutput } from '../schema';
import { eq } from 'drizzle-orm';

export const createAgentOutput = async (input: CreateAgentOutputInput): Promise<AgentOutput> => {
  try {
    // Verify the run exists
    const run = await db.select()
      .from(agentRunsTable)
      .where(eq(agentRunsTable.id, input.run_id))
      .execute();

    if (run.length === 0) {
      throw new Error(`Agent run with ID ${input.run_id} not found`);
    }

    const result = await db.insert(agentOutputsTable)
      .values({
        run_id: input.run_id,
        output_type: input.output_type,
        content: input.content,
        timestamp: input.timestamp || new Date()
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Agent output creation failed:', error);
    throw error;
  }
};