import { db } from '../db';
import { agentsTable } from '../db/schema';
import { type CreateAgentInput, type Agent } from '../schema';

export const createAgent = async (input: CreateAgentInput): Promise<Agent> => {
  try {
    const result = await db.insert(agentsTable)
      .values({
        name: input.name,
        description: input.description,
        role: input.role,
        goal: input.goal,
        backstory: input.backstory,
        is_active: input.is_active
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Agent creation failed:', error);
    throw error;
  }
};