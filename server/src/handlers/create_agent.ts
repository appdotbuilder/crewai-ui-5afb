import { db } from '../db';
import { agentsTable } from '../db/schema';
import { type CreateAgentInput, type Agent } from '../schema';

export const createAgent = async (input: CreateAgentInput): Promise<Agent> => {
  try {
    // Insert agent record
    const result = await db.insert(agentsTable)
      .values({
        name: input.name,
        description: input.description,
        role: input.role,
        goal: input.goal,
        backstory: input.backstory,
        is_active: input.is_active // Zod default is already applied
      })
      .returning()
      .execute();

    // Return the created agent
    const agent = result[0];
    return agent;
  } catch (error) {
    console.error('Agent creation failed:', error);
    throw error;
  }
};