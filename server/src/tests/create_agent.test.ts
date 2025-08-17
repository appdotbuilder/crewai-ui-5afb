import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agentsTable } from '../db/schema';
import { type CreateAgentInput } from '../schema';
import { createAgent } from '../handlers/create_agent';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateAgentInput = {
  name: 'Test Agent',
  description: 'A test agent for automated testing',
  role: 'Software Tester',
  goal: 'Execute comprehensive test scenarios',
  backstory: 'An experienced QA engineer with expertise in test automation',
  is_active: true
};

// Test input with minimal required fields
const minimalInput: CreateAgentInput = {
  name: 'Minimal Agent',
  description: null,
  role: 'Basic Role',
  goal: 'Basic Goal',
  backstory: 'Basic Backstory',
  is_active: true // Should use Zod default
};

describe('createAgent', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an agent with all fields', async () => {
    const result = await createAgent(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Agent');
    expect(result.description).toEqual('A test agent for automated testing');
    expect(result.role).toEqual('Software Tester');
    expect(result.goal).toEqual('Execute comprehensive test scenarios');
    expect(result.backstory).toEqual('An experienced QA engineer with expertise in test automation');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create an agent with minimal fields', async () => {
    const result = await createAgent(minimalInput);

    expect(result.name).toEqual('Minimal Agent');
    expect(result.description).toBeNull();
    expect(result.role).toEqual('Basic Role');
    expect(result.goal).toEqual('Basic Goal');
    expect(result.backstory).toEqual('Basic Backstory');
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should apply Zod default for is_active when not provided', async () => {
    const inputWithoutIsActive = {
      name: 'Default Test Agent',
      description: 'Testing default values',
      role: 'Default Tester',
      goal: 'Test defaults',
      backstory: 'Agent created to test default behavior'
      // is_active not provided - should use Zod default (true)
    } as CreateAgentInput;

    const result = await createAgent(inputWithoutIsActive);

    expect(result.is_active).toEqual(true);
    expect(result.name).toEqual('Default Test Agent');
  });

  it('should save agent to database', async () => {
    const result = await createAgent(testInput);

    // Query using proper drizzle syntax
    const agents = await db.select()
      .from(agentsTable)
      .where(eq(agentsTable.id, result.id))
      .execute();

    expect(agents).toHaveLength(1);
    expect(agents[0].name).toEqual('Test Agent');
    expect(agents[0].description).toEqual('A test agent for automated testing');
    expect(agents[0].role).toEqual('Software Tester');
    expect(agents[0].goal).toEqual('Execute comprehensive test scenarios');
    expect(agents[0].backstory).toEqual('An experienced QA engineer with expertise in test automation');
    expect(agents[0].is_active).toEqual(true);
    expect(agents[0].created_at).toBeInstanceOf(Date);
    expect(agents[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle null description correctly', async () => {
    const inputWithNullDescription: CreateAgentInput = {
      name: 'Null Description Agent',
      description: null,
      role: 'Null Handler',
      goal: 'Handle null values',
      backstory: 'Specialized in null handling',
      is_active: false
    };

    const result = await createAgent(inputWithNullDescription);

    expect(result.description).toBeNull();
    expect(result.is_active).toEqual(false);

    // Verify in database
    const agents = await db.select()
      .from(agentsTable)
      .where(eq(agentsTable.id, result.id))
      .execute();

    expect(agents[0].description).toBeNull();
    expect(agents[0].is_active).toEqual(false);
  });

  it('should create multiple agents with unique IDs', async () => {
    const agent1 = await createAgent({
      name: 'Agent 1',
      description: 'First agent',
      role: 'Role 1',
      goal: 'Goal 1',
      backstory: 'Backstory 1',
      is_active: true
    });

    const agent2 = await createAgent({
      name: 'Agent 2',
      description: 'Second agent',
      role: 'Role 2',
      goal: 'Goal 2',
      backstory: 'Backstory 2',
      is_active: false
    });

    // Should have different IDs
    expect(agent1.id).not.toEqual(agent2.id);
    expect(agent1.name).toEqual('Agent 1');
    expect(agent2.name).toEqual('Agent 2');
    expect(agent1.is_active).toEqual(true);
    expect(agent2.is_active).toEqual(false);

    // Verify both exist in database
    const allAgents = await db.select().from(agentsTable).execute();
    expect(allAgents).toHaveLength(2);
  });

  it('should set created_at and updated_at timestamps', async () => {
    const beforeCreation = new Date();
    const result = await createAgent(testInput);
    const afterCreation = new Date();

    // Timestamps should be within the test execution window
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.updated_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());

    // Initially, created_at and updated_at should be very close (same operation)
    const timeDifference = Math.abs(result.updated_at.getTime() - result.created_at.getTime());
    expect(timeDifference).toBeLessThan(1000); // Less than 1 second difference
  });
});