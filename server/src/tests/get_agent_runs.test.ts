import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agentsTable, agentRunsTable } from '../db/schema';
import { type CreateAgentInput, type StartAgentRunInput } from '../schema';
import { getAgentRuns } from '../handlers/get_agent_runs';
import { eq } from 'drizzle-orm';

describe('getAgentRuns', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data
  const testAgent1: CreateAgentInput = {
    name: 'Test Agent 1',
    description: 'First test agent',
    role: 'Assistant',
    goal: 'Help users with tasks',
    backstory: 'Created for testing purposes',
    is_active: true
  };

  const testAgent2: CreateAgentInput = {
    name: 'Test Agent 2',
    description: 'Second test agent',
    role: 'Analyst',
    goal: 'Analyze data',
    backstory: 'Data analysis specialist',
    is_active: true
  };

  const testRun1: StartAgentRunInput = {
    agent_id: 1,
    input_text: 'First test run'
  };

  const testRun2: StartAgentRunInput = {
    agent_id: 1,
    input_text: 'Second test run'
  };

  const testRun3: StartAgentRunInput = {
    agent_id: 2,
    input_text: 'Third test run for different agent'
  };

  it('should return all agent runs when no agentId is provided', async () => {
    // Create test agents
    const agent1Result = await db.insert(agentsTable)
      .values({
        name: testAgent1.name,
        description: testAgent1.description,
        role: testAgent1.role,
        goal: testAgent1.goal,
        backstory: testAgent1.backstory,
        is_active: testAgent1.is_active
      })
      .returning()
      .execute();

    const agent2Result = await db.insert(agentsTable)
      .values({
        name: testAgent2.name,
        description: testAgent2.description,
        role: testAgent2.role,
        goal: testAgent2.goal,
        backstory: testAgent2.backstory,
        is_active: testAgent2.is_active
      })
      .returning()
      .execute();

    // Create test runs with slight delays to ensure ordering
    await db.insert(agentRunsTable)
      .values({
        agent_id: agent1Result[0].id,
        input_text: testRun1.input_text
      })
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(agentRunsTable)
      .values({
        agent_id: agent1Result[0].id,
        input_text: testRun2.input_text
      })
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(agentRunsTable)
      .values({
        agent_id: agent2Result[0].id,
        input_text: testRun3.input_text
      })
      .execute();

    const result = await getAgentRuns();

    // Should return all runs
    expect(result).toHaveLength(3);

    // Verify basic structure and ordering (most recent first)
    expect(result[0].input_text).toEqual(testRun3.input_text);
    expect(result[1].input_text).toEqual(testRun2.input_text);
    expect(result[2].input_text).toEqual(testRun1.input_text);

    // Verify all required fields are present
    result.forEach(run => {
      expect(run.id).toBeDefined();
      expect(run.agent_id).toBeDefined();
      expect(run.input_text).toBeDefined();
      expect(run.status).toBeDefined();
      expect(run.created_at).toBeInstanceOf(Date);
      expect(run.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return runs for specific agent when agentId is provided', async () => {
    // Create test agents
    const agent1Result = await db.insert(agentsTable)
      .values({
        name: testAgent1.name,
        description: testAgent1.description,
        role: testAgent1.role,
        goal: testAgent1.goal,
        backstory: testAgent1.backstory,
        is_active: testAgent1.is_active
      })
      .returning()
      .execute();

    const agent2Result = await db.insert(agentsTable)
      .values({
        name: testAgent2.name,
        description: testAgent2.description,
        role: testAgent2.role,
        goal: testAgent2.goal,
        backstory: testAgent2.backstory,
        is_active: testAgent2.is_active
      })
      .returning()
      .execute();

    // Create test runs for both agents with delays to ensure ordering
    await db.insert(agentRunsTable)
      .values({
        agent_id: agent1Result[0].id,
        input_text: testRun1.input_text
      })
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(agentRunsTable)
      .values({
        agent_id: agent1Result[0].id,
        input_text: testRun2.input_text
      })
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(agentRunsTable)
      .values({
        agent_id: agent2Result[0].id,
        input_text: testRun3.input_text
      })
      .execute();

    const result = await getAgentRuns(agent1Result[0].id);

    // Should return only runs for agent 1
    expect(result).toHaveLength(2);

    // Verify all runs belong to the specified agent
    result.forEach(run => {
      expect(run.agent_id).toEqual(agent1Result[0].id);
    });

    // Verify ordering (most recent first)
    expect(result[0].input_text).toEqual(testRun2.input_text);
    expect(result[1].input_text).toEqual(testRun1.input_text);
  });

  it('should return empty array when no runs exist for specified agent', async () => {
    // Create a test agent but no runs
    const agentResult = await db.insert(agentsTable)
      .values({
        name: testAgent1.name,
        description: testAgent1.description,
        role: testAgent1.role,
        goal: testAgent1.goal,
        backstory: testAgent1.backstory,
        is_active: testAgent1.is_active
      })
      .returning()
      .execute();

    const result = await getAgentRuns(agentResult[0].id);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array when no runs exist at all', async () => {
    const result = await getAgentRuns();

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle non-existent agent ID gracefully', async () => {
    // Create some runs for existing agents
    const agentResult = await db.insert(agentsTable)
      .values({
        name: testAgent1.name,
        description: testAgent1.description,
        role: testAgent1.role,
        goal: testAgent1.goal,
        backstory: testAgent1.backstory,
        is_active: testAgent1.is_active
      })
      .returning()
      .execute();

    await db.insert(agentRunsTable)
      .values({
        agent_id: agentResult[0].id,
        input_text: testRun1.input_text
      })
      .execute();

    // Query for non-existent agent ID
    const result = await getAgentRuns(99999);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should preserve run status and timestamps correctly', async () => {
    // Create test agent
    const agentResult = await db.insert(agentsTable)
      .values({
        name: testAgent1.name,
        description: testAgent1.description,
        role: testAgent1.role,
        goal: testAgent1.goal,
        backstory: testAgent1.backstory,
        is_active: testAgent1.is_active
      })
      .returning()
      .execute();

    // Create run with specific status
    const startTime = new Date();
    await db.insert(agentRunsTable)
      .values({
        agent_id: agentResult[0].id,
        input_text: testRun1.input_text,
        status: 'running',
        started_at: startTime
      })
      .execute();

    const result = await getAgentRuns(agentResult[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].status).toEqual('running');
    expect(result[0].started_at).toBeInstanceOf(Date);
    expect(result[0].completed_at).toBeNull();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should verify runs are saved to database correctly', async () => {
    // Create test agent
    const agentResult = await db.insert(agentsTable)
      .values({
        name: testAgent1.name,
        description: testAgent1.description,
        role: testAgent1.role,
        goal: testAgent1.goal,
        backstory: testAgent1.backstory,
        is_active: testAgent1.is_active
      })
      .returning()
      .execute();

    // Create test run
    const runResult = await db.insert(agentRunsTable)
      .values({
        agent_id: agentResult[0].id,
        input_text: testRun1.input_text
      })
      .returning()
      .execute();

    // Query directly from database to verify
    const dbRuns = await db.select()
      .from(agentRunsTable)
      .where(eq(agentRunsTable.id, runResult[0].id))
      .execute();

    expect(dbRuns).toHaveLength(1);
    expect(dbRuns[0].input_text).toEqual(testRun1.input_text);
    expect(dbRuns[0].agent_id).toEqual(agentResult[0].id);

    // Now test the handler
    const handlerResult = await getAgentRuns(agentResult[0].id);

    expect(handlerResult).toHaveLength(1);
    expect(handlerResult[0].id).toEqual(runResult[0].id);
    expect(handlerResult[0].input_text).toEqual(testRun1.input_text);
  });
});