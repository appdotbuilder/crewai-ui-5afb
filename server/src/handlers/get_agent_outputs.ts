import { db } from '../db';
import { agentOutputsTable } from '../db/schema';
import { type AgentOutput } from '../schema';
import { eq, asc } from 'drizzle-orm';

export async function getAgentOutputs(runId: number): Promise<AgentOutput[]> {
  try {
    // Query outputs for the specific run, ordered by timestamp for chronological display
    const results = await db.select()
      .from(agentOutputsTable)
      .where(eq(agentOutputsTable.run_id, runId))
      .orderBy(asc(agentOutputsTable.timestamp))
      .execute();

    // Return results as-is since all fields are already properly typed
    return results;
  } catch (error) {
    console.error('Failed to fetch agent outputs:', error);
    throw error;
  }
}