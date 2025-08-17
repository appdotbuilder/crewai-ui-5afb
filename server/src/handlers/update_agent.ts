import { db } from '../db';
import { agentsTable } from '../db/schema';
import { type UpdateAgentInput, type Agent } from '../schema';
import { eq } from 'drizzle-orm';

export async function updateAgent(input: UpdateAgentInput): Promise<Agent | null> {
  try {
    // Build update object only with provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.role !== undefined) {
      updateData.role = input.role;
    }
    if (input.goal !== undefined) {
      updateData.goal = input.goal;
    }
    if (input.backstory !== undefined) {
      updateData.backstory = input.backstory;
    }
    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
    }

    // Update the agent and return the updated record
    const result = await db.update(agentsTable)
      .set(updateData)
      .where(eq(agentsTable.id, input.id))
      .returning()
      .execute();

    // Return null if no agent was found with the given ID
    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error) {
    console.error('Agent update failed:', error);
    throw error;
  }
}