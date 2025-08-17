import { db } from '../db';
import { agentRunsTable } from '../db/schema';
import { type UpdateAgentRunInput, type AgentRun } from '../schema';
import { eq } from 'drizzle-orm';

export const updateAgentRunStatus = async (input: UpdateAgentRunInput): Promise<AgentRun | null> => {
  try {
    // First check if the run exists
    const existingRun = await db.select()
      .from(agentRunsTable)
      .where(eq(agentRunsTable.id, input.id))
      .execute();

    if (existingRun.length === 0) {
      return null;
    }

    const currentRun = existingRun[0];

    // Build update object with provided fields
    const updateData: Partial<typeof agentRunsTable.$inferInsert> = {
      status: input.status,
      updated_at: new Date()
    };

    // Handle started_at timestamp
    if (input.started_at !== undefined) {
      updateData.started_at = input.started_at;
    } else if (input.status === 'running' && !currentRun.started_at) {
      // Only auto-set started_at if it's not already set and status is changing to running
      updateData.started_at = new Date();
    }
    // If started_at is not provided and already exists, preserve it (don't set it in updateData)

    // Handle completed_at timestamp  
    if (input.completed_at !== undefined) {
      updateData.completed_at = input.completed_at;
    } else if ((input.status === 'completed' || input.status === 'failed') && !currentRun.completed_at) {
      // Only auto-set completed_at if it's not already set and status is changing to completed/failed
      updateData.completed_at = new Date();
    }
    // If completed_at is not provided and already exists, preserve it (don't set it in updateData)

    const result = await db.update(agentRunsTable)
      .set(updateData)
      .where(eq(agentRunsTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Agent run status update failed:', error);
    throw error;
  }
};