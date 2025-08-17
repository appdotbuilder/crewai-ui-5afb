import { db } from '../db';
import { agentRunsTable } from '../db/schema';
import { type AgentRun } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getAgentRuns(agentId?: number): Promise<AgentRun[]> {
  try {
    // Build query based on whether filtering is needed
    const results = agentId !== undefined
      ? await db.select()
          .from(agentRunsTable)
          .where(eq(agentRunsTable.agent_id, agentId))
          .orderBy(desc(agentRunsTable.created_at))
          .execute()
      : await db.select()
          .from(agentRunsTable)
          .orderBy(desc(agentRunsTable.created_at))
          .execute();

    // Return results - no numeric conversions needed for this table
    return results;
  } catch (error) {
    console.error('Failed to fetch agent runs:', error);
    throw error;
  }
}