import { db } from '../db';
import { agentRunsTable, agentOutputsTable } from '../db/schema';
import { type AgentRunWithOutputs } from '../schema';
import { eq } from 'drizzle-orm';

export const getAgentRun = async (id: number): Promise<AgentRunWithOutputs | null> => {
  try {
    // Get the agent run
    const runResult = await db.select()
      .from(agentRunsTable)
      .where(eq(agentRunsTable.id, id))
      .execute();

    if (runResult.length === 0) {
      return null;
    }

    const run = runResult[0];

    // Get associated outputs ordered by id (creation order)
    const outputs = await db.select()
      .from(agentOutputsTable)
      .where(eq(agentOutputsTable.run_id, id))
      .orderBy(agentOutputsTable.id)
      .execute();

    // Return run with outputs
    return {
      ...run,
      outputs
    };
  } catch (error) {
    console.error('Failed to get agent run:', error);
    throw error;
  }
};