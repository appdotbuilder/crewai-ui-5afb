import { db } from '../db';
import { agentOutputsTable } from '../db/schema';
import { type CreateAgentOutputInput, type AgentOutput } from '../schema';

export const createAgentOutput = async (input: CreateAgentOutputInput): Promise<AgentOutput> => {
  try {
    // Insert agent output record
    const result = await db.insert(agentOutputsTable)
      .values({
        run_id: input.run_id,
        output_type: input.output_type,
        content: input.content,
        timestamp: input.timestamp || new Date(), // Default to current time if not provided
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Agent output creation failed:', error);
    throw error;
  }
};