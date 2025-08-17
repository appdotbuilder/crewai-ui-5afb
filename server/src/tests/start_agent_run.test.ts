import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agentsTable, agentRunsTable } from '../db/schema';
import { type StartAgentRunInput } from '../schema';
import { startAgentRun } from '../handlers/start_agent_run';
import { eq } from 'drizzle-orm';

// Test agent data
const testAgent = {
  name: 'Test Agent',
  description: 'An agent for testing',
  role: 'Tester',
  goal: 'Test everything thoroughly',
  backstory: 'Born to test',
  is_active: true
};

const inactiveAgent = {
  name: 'Inactive Agent',
  description: 'An inactive agent',
  role: 'Sleeper',
  goal: 'Sleep peacefully',
  backstory: 'Needs rest',
  is_active: false
};

describe('startAgentRun', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an agent run for an active agent', async () => {
    // Create test agent
    const agentResult = await db.insert(agentsTable)
      .values(testAgent)
      .returning()
      .execute();
    const agent = agentResult[0];

    const testInput: StartAgentRunInput = {
      agent_id: agent.id,
      input_text: 'Please analyze this data'
    };

    const result = await startAgentRun(testInput);

    // Verify run properties
    expect(result.agent_id).toEqual(agent.id);
    expect(result.input_text).toEqual('Please analyze this data');
    expect(result.status).toEqual('pending');
    expect(result.started_at).toBeNull();
    expect(result.completed_at).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save agent run to database', async () => {
    // Create test agent
    const agentResult = await db.insert(agentsTable)
      .values(testAgent)
      .returning()
      .execute();
    const agent = agentResult[0];

    const testInput: StartAgentRunInput = {
      agent_id: agent.id,
      input_text: 'Process this request'
    };

    const result = await startAgentRun(testInput);

    // Query database to verify run was saved
    const runs = await db.select()
      .from(agentRunsTable)
      .where(eq(agentRunsTable.id, result.id))
      .execute();

    expect(runs).toHaveLength(1);
    expect(runs[0].agent_id).toEqual(agent.id);
    expect(runs[0].input_text).toEqual('Process this request');
    expect(runs[0].status).toEqual('pending');
    expect(runs[0].started_at).toBeNull();
    expect(runs[0].completed_at).toBeNull();
    expect(runs[0].created_at).toBeInstanceOf(Date);
    expect(runs[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent agent', async () => {
    const testInput: StartAgentRunInput = {
      agent_id: 9999, // Non-existent agent ID
      input_text: 'This should fail'
    };

    await expect(startAgentRun(testInput))
      .rejects.toThrow(/Agent with id 9999 not found/i);
  });

  it('should throw error for inactive agent', async () => {
    // Create inactive agent
    const agentResult = await db.insert(agentsTable)
      .values(inactiveAgent)
      .returning()
      .execute();
    const agent = agentResult[0];

    const testInput: StartAgentRunInput = {
      agent_id: agent.id,
      input_text: 'This should fail for inactive agent'
    };

    await expect(startAgentRun(testInput))
      .rejects.toThrow(/Agent with id \d+ is not active/i);
  });

  it('should create multiple runs for the same agent', async () => {
    // Create test agent
    const agentResult = await db.insert(agentsTable)
      .values(testAgent)
      .returning()
      .execute();
    const agent = agentResult[0];

    const input1: StartAgentRunInput = {
      agent_id: agent.id,
      input_text: 'First task'
    };

    const input2: StartAgentRunInput = {
      agent_id: agent.id,
      input_text: 'Second task'
    };

    // Create two runs
    const run1 = await startAgentRun(input1);
    const run2 = await startAgentRun(input2);

    // Verify both runs exist and are different
    expect(run1.id).not.toEqual(run2.id);
    expect(run1.input_text).toEqual('First task');
    expect(run2.input_text).toEqual('Second task');
    expect(run1.agent_id).toEqual(agent.id);
    expect(run2.agent_id).toEqual(agent.id);

    // Verify both runs are in database
    const runs = await db.select()
      .from(agentRunsTable)
      .where(eq(agentRunsTable.agent_id, agent.id))
      .execute();

    expect(runs).toHaveLength(2);
    expect(runs.map(r => r.input_text).sort()).toEqual(['First task', 'Second task']);
  });

  it('should handle long input text', async () => {
    // Create test agent
    const agentResult = await db.insert(agentsTable)
      .values(testAgent)
      .returning()
      .execute();
    const agent = agentResult[0];

    const longText = 'A'.repeat(1000); // 1000 character string
    const testInput: StartAgentRunInput = {
      agent_id: agent.id,
      input_text: longText
    };

    const result = await startAgentRun(testInput);

    expect(result.input_text).toEqual(longText);
    expect(result.input_text.length).toEqual(1000);
  });
});