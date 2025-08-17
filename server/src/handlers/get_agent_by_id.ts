import { db } from '../db';
import { agentsTable } from '../db/schema';
import { type Agent } from '../schema';
import { eq } from 'drizzle-orm';

export async function getAgentById(id: number): Promise<Agent | null> {
  try {
    // Query the database for the agent with the specified ID
    const results = await db.select()
      .from(agentsTable)
      .where(eq(agentsTable.id, id))
      .execute();

    // Return the agent if found, otherwise null
    if (results.length === 0) {
      return null;
    }

    return results[0];
  } catch (error) {
    console.error('Failed to get agent by ID:', error);
    throw error;
  }
}