import { db } from '../db';
import { agentsTable } from '../db/schema';
import { type Agent } from '../schema';
import { eq } from 'drizzle-orm';

export async function getAgents(): Promise<Agent[]> {
  try {
    // Fetch all active agents from the database
    const results = await db.select()
      .from(agentsTable)
      .where(eq(agentsTable.is_active, true))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    throw error;
  }
}