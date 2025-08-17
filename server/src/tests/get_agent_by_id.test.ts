import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agentsTable } from '../db/schema';
import { type CreateAgentInput } from '../schema';
import { getAgentById } from '../handlers/get_agent_by_id';

// Test agent data
const testAgent: CreateAgentInput = {
  name: 'Test Agent',
  description: 'A test agent for unit testing',
  role: 'Data Analyst',
  goal: 'Analyze data and provide insights',
  backstory: 'An experienced data analyst with expertise in statistical analysis',
  is_active: true
};

const testAgentMinimal: CreateAgentInput = {
  name: 'Minimal Agent',
  description: null,
  role: 'Researcher',
  goal: 'Conduct research',
  backstory: 'A dedicated researcher',
  is_active: false
};

describe('getAgentById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return agent when ID exists', async () => {
    // Create a test agent
    const createdAgents = await db.insert(agentsTable)
      .values(testAgent)
      .returning()
      .execute();

    const createdAgent = createdAgents[0];

    // Fetch the agent by ID
    const result = await getAgentById(createdAgent.id);

    // Verify the result
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdAgent.id);
    expect(result!.name).toEqual('Test Agent');
    expect(result!.description).toEqual('A test agent for unit testing');
    expect(result!.role).toEqual('Data Analyst');
    expect(result!.goal).toEqual('Analyze data and provide insights');
    expect(result!.backstory).toEqual('An experienced data analyst with expertise in statistical analysis');
    expect(result!.is_active).toBe(true);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when agent ID does not exist', async () => {
    // Try to fetch an agent with a non-existent ID
    const result = await getAgentById(99999);

    // Verify the result is null
    expect(result).toBeNull();
  });

  it('should handle agent with null description', async () => {
    // Create agent with null description
    const createdAgents = await db.insert(agentsTable)
      .values(testAgentMinimal)
      .returning()
      .execute();

    const createdAgent = createdAgents[0];

    // Fetch the agent by ID
    const result = await getAgentById(createdAgent.id);

    // Verify the result
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(createdAgent.id);
    expect(result!.name).toEqual('Minimal Agent');
    expect(result!.description).toBeNull();
    expect(result!.role).toEqual('Researcher');
    expect(result!.goal).toEqual('Conduct research');
    expect(result!.backstory).toEqual('A dedicated researcher');
    expect(result!.is_active).toBe(false);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return the correct agent when multiple agents exist', async () => {
    // Create multiple test agents
    const createdAgents = await db.insert(agentsTable)
      .values([testAgent, testAgentMinimal])
      .returning()
      .execute();

    const firstAgent = createdAgents[0];
    const secondAgent = createdAgents[1];

    // Fetch the first agent by ID
    const result1 = await getAgentById(firstAgent.id);
    expect(result1).not.toBeNull();
    expect(result1!.id).toEqual(firstAgent.id);
    expect(result1!.name).toEqual('Test Agent');

    // Fetch the second agent by ID
    const result2 = await getAgentById(secondAgent.id);
    expect(result2).not.toBeNull();
    expect(result2!.id).toEqual(secondAgent.id);
    expect(result2!.name).toEqual('Minimal Agent');

    // Verify they are different agents
    expect(result1!.id).not.toEqual(result2!.id);
  });

  it('should handle negative ID numbers', async () => {
    // Try to fetch an agent with a negative ID
    const result = await getAgentById(-1);

    // Verify the result is null
    expect(result).toBeNull();
  });

  it('should handle zero ID', async () => {
    // Try to fetch an agent with ID zero
    const result = await getAgentById(0);

    // Verify the result is null
    expect(result).toBeNull();
  });
});