import { db } from '../db';
import { agentsTable } from '../db/schema';
import { type Agent } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getAgents = async (): Promise<Agent[]> => {
  try {
    const result = await db.select()
      .from(agentsTable)
      .where(eq(agentsTable.is_active, true))
      .orderBy(desc(agentsTable.created_at))
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to get agents:', error);
    throw error;
  }
};