import { db } from '../db';
import { agentOutputsTable } from '../db/schema';
import { type AgentOutput } from '../schema';
import { eq, asc } from 'drizzle-orm';

export const getAgentOutputs = async (runId: number): Promise<AgentOutput[]> => {
  try {
    const result = await db.select()
      .from(agentOutputsTable)
      .where(eq(agentOutputsTable.run_id, runId))
      .orderBy(asc(agentOutputsTable.timestamp))
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to get agent outputs:', error);
    throw error;
  }
};