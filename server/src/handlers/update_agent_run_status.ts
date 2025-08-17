import { db } from '../db';
import { agentRunsTable } from '../db/schema';
import { type UpdateAgentRunInput, type AgentRun } from '../schema';
import { eq } from 'drizzle-orm';

export async function updateAgentRunStatus(input: UpdateAgentRunInput): Promise<AgentRun | null> {
  try {
    // First, get the current record to check existing timestamps and status
    const currentRecord = await db
      .select()
      .from(agentRunsTable)
      .where(eq(agentRunsTable.id, input.id))
      .execute();

    if (currentRecord.length === 0) {
      return null;
    }

    const current = currentRecord[0];

    // Prepare the update values
    const updateValues: Partial<typeof agentRunsTable.$inferInsert> = {
      status: input.status,
      updated_at: new Date()
    };

    // Set timestamps based on status changes and current state
    if (input.started_at !== undefined) {
      // Explicit started_at provided in input
      updateValues.started_at = input.started_at;
    } else if (input.status === 'running' && !current.started_at) {
      // Only set started_at if transitioning to running and it's not already set
      updateValues.started_at = new Date();
    }

    if (input.completed_at !== undefined) {
      // Explicit completed_at provided in input
      updateValues.completed_at = input.completed_at;
    } else if ((input.status === 'completed' || input.status === 'failed') && !current.completed_at) {
      // Only set completed_at if transitioning to completed/failed and it's not already set
      updateValues.completed_at = new Date();
    }

    // Update the agent run record
    const result = await db
      .update(agentRunsTable)
      .set(updateValues)
      .where(eq(agentRunsTable.id, input.id))
      .returning()
      .execute();

    // Return the updated record or null if not found
    return result[0] || null;
  } catch (error) {
    console.error('Agent run status update failed:', error);
    throw error;
  }
}