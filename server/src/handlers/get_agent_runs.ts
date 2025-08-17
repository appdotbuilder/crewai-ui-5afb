import { db } from '../db';
import { agentRunsTable } from '../db/schema';
import { type AgentRun } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getAgentRuns = async (agentId?: number): Promise<AgentRun[]> => {
  try {
    if (agentId !== undefined) {
      const result = await db.select()
        .from(agentRunsTable)
        .where(eq(agentRunsTable.agent_id, agentId))
        .orderBy(desc(agentRunsTable.created_at))
        .execute();
      
      return result;
    }

    const result = await db.select()
      .from(agentRunsTable)
      .orderBy(desc(agentRunsTable.created_at))
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to get agent runs:', error);
    throw error;
  }
};