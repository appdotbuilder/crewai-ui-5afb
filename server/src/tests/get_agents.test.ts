import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agentsTable } from '../db/schema';
import { type CreateAgentInput } from '../schema';
import { getAgents } from '../handlers/get_agents';

// Test data for agents
const testAgent1: CreateAgentInput = {
  name: 'Research Agent',
  description: 'Agent for research tasks',
  role: 'Researcher',
  goal: 'Conduct thorough research on given topics',
  backstory: 'A dedicated research agent with expertise in information gathering',
  is_active: true
};

const testAgent2: CreateAgentInput = {
  name: 'Writing Agent',
  description: 'Agent for content writing',
  role: 'Writer',
  goal: 'Create high-quality written content',
  backstory: 'An experienced writing agent skilled in various content formats',
  is_active: true
};

const inactiveAgent: CreateAgentInput = {
  name: 'Inactive Agent',
  description: 'Agent that is not active',
  role: 'Tester',
  goal: 'Test inactive agent functionality',
  backstory: 'An agent used for testing inactive states',
  is_active: false
};

describe('getAgents', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no agents exist', async () => {
    const result = await getAgents();

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return all active agents', async () => {
    // Create test agents
    await db.insert(agentsTable)
      .values([testAgent1, testAgent2])
      .execute();

    const result = await getAgents();

    expect(result).toHaveLength(2);
    expect(result[0].name).toEqual('Research Agent');
    expect(result[0].description).toEqual('Agent for research tasks');
    expect(result[0].role).toEqual('Researcher');
    expect(result[0].goal).toEqual('Conduct thorough research on given topics');
    expect(result[0].backstory).toEqual('A dedicated research agent with expertise in information gathering');
    expect(result[0].is_active).toBe(true);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);

    expect(result[1].name).toEqual('Writing Agent');
    expect(result[1].is_active).toBe(true);
  });

  it('should not return inactive agents', async () => {
    // Create both active and inactive agents
    await db.insert(agentsTable)
      .values([testAgent1, inactiveAgent])
      .execute();

    const result = await getAgents();

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Research Agent');
    expect(result[0].is_active).toBe(true);
    
    // Verify inactive agent exists in database but is not returned
    const allAgents = await db.select()
      .from(agentsTable)
      .execute();
    expect(allAgents).toHaveLength(2);
  });

  it('should handle agents with null descriptions', async () => {
    const agentWithNullDescription = {
      ...testAgent1,
      description: null
    };

    await db.insert(agentsTable)
      .values([agentWithNullDescription])
      .execute();

    const result = await getAgents();

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Research Agent');
    expect(result[0].description).toBeNull();
    expect(result[0].is_active).toBe(true);
  });

  it('should return agents in database order', async () => {
    // Create agents in specific order
    const agents = [testAgent1, testAgent2];
    
    await db.insert(agentsTable)
      .values(agents)
      .execute();

    const result = await getAgents();

    expect(result).toHaveLength(2);
    // Verify order is maintained (should match insertion order due to id sequence)
    expect(result[0].name).toEqual('Research Agent');
    expect(result[1].name).toEqual('Writing Agent');
    expect(result[0].id).toBeLessThan(result[1].id);
  });

  it('should return agents with all required fields', async () => {
    await db.insert(agentsTable)
      .values([testAgent1])
      .execute();

    const result = await getAgents();

    expect(result).toHaveLength(1);
    const agent = result[0];

    // Verify all schema fields are present
    expect(typeof agent.id).toBe('number');
    expect(typeof agent.name).toBe('string');
    expect(agent.description === null || typeof agent.description === 'string').toBe(true);
    expect(typeof agent.role).toBe('string');
    expect(typeof agent.goal).toBe('string');
    expect(typeof agent.backstory).toBe('string');
    expect(typeof agent.is_active).toBe('boolean');
    expect(agent.created_at).toBeInstanceOf(Date);
    expect(agent.updated_at).toBeInstanceOf(Date);
  });
});