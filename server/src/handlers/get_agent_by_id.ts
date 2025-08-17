import { db } from '../db';
import { agentsTable } from '../db/schema';
import { type Agent } from '../schema';
import { eq } from 'drizzle-orm';

export const getAgentById = async (id: number): Promise<Agent | null> => {
  try {
    const result = await db.select()
      .from(agentsTable)
      .where(eq(agentsTable.id, id))
      .execute();

    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error) {
    console.error('Failed to get agent by ID:', error);
    throw error;
  }
};