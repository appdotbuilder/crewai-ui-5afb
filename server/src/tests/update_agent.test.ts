import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agentsTable } from '../db/schema';
import { type UpdateAgentInput, type CreateAgentInput } from '../schema';
import { updateAgent } from '../handlers/update_agent';
import { eq } from 'drizzle-orm';

// Helper function to create a test agent
const createTestAgent = async (agentData: CreateAgentInput) => {
  const result = await db.insert(agentsTable)
    .values({
      name: agentData.name,
      description: agentData.description,
      role: agentData.role,
      goal: agentData.goal,
      backstory: agentData.backstory,
      is_active: agentData.is_active ?? true
    })
    .returning()
    .execute();
  
  return result[0];
};

// Test agent data
const testAgentData: CreateAgentInput = {
  name: 'Test Agent',
  description: 'A test agent for updating',
  role: 'Data Analyst',
  goal: 'Analyze test data',
  backstory: 'Created for testing purposes',
  is_active: true
};

describe('updateAgent', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update all agent fields', async () => {
    // Create initial agent
    const initialAgent = await createTestAgent(testAgentData);
    
    // Update input with all fields
    const updateInput: UpdateAgentInput = {
      id: initialAgent.id,
      name: 'Updated Agent Name',
      description: 'Updated description',
      role: 'Senior Data Analyst',
      goal: 'Updated goal',
      backstory: 'Updated backstory',
      is_active: false
    };

    const result = await updateAgent(updateInput);

    // Verify the update was successful
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(initialAgent.id);
    expect(result!.name).toEqual('Updated Agent Name');
    expect(result!.description).toEqual('Updated description');
    expect(result!.role).toEqual('Senior Data Analyst');
    expect(result!.goal).toEqual('Updated goal');
    expect(result!.backstory).toEqual('Updated backstory');
    expect(result!.is_active).toEqual(false);
    expect(result!.created_at).toEqual(initialAgent.created_at);
    expect(result!.updated_at).not.toEqual(initialAgent.updated_at);
  });

  it('should update only specified fields', async () => {
    // Create initial agent
    const initialAgent = await createTestAgent(testAgentData);
    
    // Update only name and role
    const updateInput: UpdateAgentInput = {
      id: initialAgent.id,
      name: 'Partially Updated Agent',
      role: 'Lead Analyst'
    };

    const result = await updateAgent(updateInput);

    // Verify only specified fields were updated
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(initialAgent.id);
    expect(result!.name).toEqual('Partially Updated Agent');
    expect(result!.description).toEqual(initialAgent.description);
    expect(result!.role).toEqual('Lead Analyst');
    expect(result!.goal).toEqual(initialAgent.goal);
    expect(result!.backstory).toEqual(initialAgent.backstory);
    expect(result!.is_active).toEqual(initialAgent.is_active);
    expect(result!.created_at).toEqual(initialAgent.created_at);
    expect(result!.updated_at).not.toEqual(initialAgent.updated_at);
  });

  it('should handle null description update', async () => {
    // Create initial agent
    const initialAgent = await createTestAgent(testAgentData);
    
    // Update description to null
    const updateInput: UpdateAgentInput = {
      id: initialAgent.id,
      description: null
    };

    const result = await updateAgent(updateInput);

    expect(result).not.toBeNull();
    expect(result!.description).toBeNull();
    expect(result!.name).toEqual(initialAgent.name); // Other fields unchanged
  });

  it('should update is_active status', async () => {
    // Create initial agent with is_active = true
    const initialAgent = await createTestAgent({ ...testAgentData, is_active: true });
    
    // Deactivate the agent
    const updateInput: UpdateAgentInput = {
      id: initialAgent.id,
      is_active: false
    };

    const result = await updateAgent(updateInput);

    expect(result).not.toBeNull();
    expect(result!.is_active).toEqual(false);
    expect(result!.name).toEqual(initialAgent.name); // Other fields unchanged
  });

  it('should return null for non-existent agent ID', async () => {
    const updateInput: UpdateAgentInput = {
      id: 99999, // Non-existent ID
      name: 'This should not work'
    };

    const result = await updateAgent(updateInput);

    expect(result).toBeNull();
  });

  it('should save updates to database', async () => {
    // Create initial agent
    const initialAgent = await createTestAgent(testAgentData);
    
    // Update the agent
    const updateInput: UpdateAgentInput = {
      id: initialAgent.id,
      name: 'Database Test Agent',
      role: 'Database Tester'
    };

    await updateAgent(updateInput);

    // Query the database directly to verify the update
    const updatedAgentFromDB = await db.select()
      .from(agentsTable)
      .where(eq(agentsTable.id, initialAgent.id))
      .execute();

    expect(updatedAgentFromDB).toHaveLength(1);
    expect(updatedAgentFromDB[0].name).toEqual('Database Test Agent');
    expect(updatedAgentFromDB[0].role).toEqual('Database Tester');
    expect(updatedAgentFromDB[0].goal).toEqual(initialAgent.goal); // Unchanged field
    expect(updatedAgentFromDB[0].updated_at).not.toEqual(initialAgent.updated_at);
  });

  it('should handle edge case with only updated_at change', async () => {
    // Create initial agent
    const initialAgent = await createTestAgent(testAgentData);
    
    // Update with no actual field changes (only updated_at should change)
    const updateInput: UpdateAgentInput = {
      id: initialAgent.id
    };

    const result = await updateAgent(updateInput);

    expect(result).not.toBeNull();
    expect(result!.name).toEqual(initialAgent.name);
    expect(result!.description).toEqual(initialAgent.description);
    expect(result!.role).toEqual(initialAgent.role);
    expect(result!.goal).toEqual(initialAgent.goal);
    expect(result!.backstory).toEqual(initialAgent.backstory);
    expect(result!.is_active).toEqual(initialAgent.is_active);
    expect(result!.created_at).toEqual(initialAgent.created_at);
    expect(result!.updated_at).not.toEqual(initialAgent.updated_at);
  });

  it('should update multiple agents independently', async () => {
    // Create two test agents
    const agent1 = await createTestAgent({ ...testAgentData, name: 'Agent 1' });
    const agent2 = await createTestAgent({ ...testAgentData, name: 'Agent 2' });
    
    // Update only agent1
    const updateInput: UpdateAgentInput = {
      id: agent1.id,
      name: 'Updated Agent 1',
      role: 'Updated Role'
    };

    const result = await updateAgent(updateInput);

    // Verify agent1 was updated
    expect(result).not.toBeNull();
    expect(result!.name).toEqual('Updated Agent 1');
    expect(result!.role).toEqual('Updated Role');

    // Verify agent2 was not affected
    const agent2FromDB = await db.select()
      .from(agentsTable)
      .where(eq(agentsTable.id, agent2.id))
      .execute();

    expect(agent2FromDB[0].name).toEqual('Agent 2');
    expect(agent2FromDB[0].role).toEqual(testAgentData.role);
    expect(agent2FromDB[0].updated_at).toEqual(agent2.updated_at);
  });
});