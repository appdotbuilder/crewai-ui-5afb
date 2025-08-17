import { db } from '../db';
import { agentRunsTable, agentOutputsTable } from '../db/schema';
import { type AgentRunWithOutputs } from '../schema';
import { eq } from 'drizzle-orm';

export async function getAgentRun(id: number): Promise<AgentRunWithOutputs | null> {
  try {
    // First get the agent run
    const runResults = await db.select()
      .from(agentRunsTable)
      .where(eq(agentRunsTable.id, id))
      .execute();

    if (runResults.length === 0) {
      return null;
    }

    const run = runResults[0];

    // Get all outputs for this run
    const outputs = await db.select()
      .from(agentOutputsTable)
      .where(eq(agentOutputsTable.run_id, id))
      .execute();

    // Return the run with its outputs
    return {
      ...run,
      outputs: outputs
    };
  } catch (error) {
    console.error('Get agent run failed:', error);
    throw error;
  }
}