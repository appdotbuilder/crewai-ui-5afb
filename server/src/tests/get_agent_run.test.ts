import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agentsTable, agentRunsTable, agentOutputsTable } from '../db/schema';
import { getAgentRun } from '../handlers/get_agent_run';

describe('getAgentRun', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null for non-existent run', async () => {
    const result = await getAgentRun(999);
    expect(result).toBeNull();
  });

  it('should return agent run with empty outputs array when no outputs exist', async () => {
    // Create test agent first
    const agentResult = await db.insert(agentsTable)
      .values({
        name: 'Test Agent',
        description: 'Test agent description',
        role: 'test_role',
        goal: 'test goal',
        backstory: 'test backstory',
        is_active: true
      })
      .returning()
      .execute();

    const agent = agentResult[0];

    // Create test run
    const runResult = await db.insert(agentRunsTable)
      .values({
        agent_id: agent.id,
        input_text: 'Test input',
        status: 'pending'
      })
      .returning()
      .execute();

    const run = runResult[0];

    // Get the run
    const result = await getAgentRun(run.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(run.id);
    expect(result!.agent_id).toEqual(agent.id);
    expect(result!.input_text).toEqual('Test input');
    expect(result!.status).toEqual('pending');
    expect(result!.outputs).toEqual([]);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return agent run with all associated outputs', async () => {
    // Create test agent
    const agentResult = await db.insert(agentsTable)
      .values({
        name: 'Test Agent',
        description: 'Test agent description',
        role: 'test_role',
        goal: 'test goal',
        backstory: 'test backstory',
        is_active: true
      })
      .returning()
      .execute();

    const agent = agentResult[0];

    // Create test run
    const runResult = await db.insert(agentRunsTable)
      .values({
        agent_id: agent.id,
        input_text: 'Test input',
        status: 'running',
        started_at: new Date()
      })
      .returning()
      .execute();

    const run = runResult[0];

    // Create multiple outputs
    const outputsData = [
      {
        run_id: run.id,
        output_type: 'log' as const,
        content: 'Starting task...'
      },
      {
        run_id: run.id,
        output_type: 'log' as const,
        content: 'Processing data...'
      },
      {
        run_id: run.id,
        output_type: 'result' as const,
        content: 'Task completed successfully'
      }
    ];

    await db.insert(agentOutputsTable)
      .values(outputsData)
      .execute();

    // Get the run with outputs
    const result = await getAgentRun(run.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(run.id);
    expect(result!.agent_id).toEqual(agent.id);
    expect(result!.input_text).toEqual('Test input');
    expect(result!.status).toEqual('running');
    expect(result!.started_at).toBeInstanceOf(Date);
    
    // Verify outputs
    expect(result!.outputs).toHaveLength(3);
    
    // Check first output
    expect(result!.outputs[0].run_id).toEqual(run.id);
    expect(result!.outputs[0].output_type).toEqual('log');
    expect(result!.outputs[0].content).toEqual('Starting task...');
    expect(result!.outputs[0].timestamp).toBeInstanceOf(Date);
    expect(result!.outputs[0].created_at).toBeInstanceOf(Date);

    // Check result output
    const resultOutput = result!.outputs.find(o => o.output_type === 'result');
    expect(resultOutput).toBeDefined();
    expect(resultOutput!.content).toEqual('Task completed successfully');
  });

  it('should return correct run even when other runs exist', async () => {
    // Create test agent
    const agentResult = await db.insert(agentsTable)
      .values({
        name: 'Test Agent',
        description: 'Test agent description',
        role: 'test_role',
        goal: 'test goal',
        backstory: 'test backstory',
        is_active: true
      })
      .returning()
      .execute();

    const agent = agentResult[0];

    // Create multiple runs
    const run1Result = await db.insert(agentRunsTable)
      .values({
        agent_id: agent.id,
        input_text: 'First input',
        status: 'completed',
        completed_at: new Date()
      })
      .returning()
      .execute();

    const run2Result = await db.insert(agentRunsTable)
      .values({
        agent_id: agent.id,
        input_text: 'Second input',
        status: 'pending'
      })
      .returning()
      .execute();

    const run1 = run1Result[0];
    const run2 = run2Result[0];

    // Create outputs for both runs
    await db.insert(agentOutputsTable)
      .values([
        {
          run_id: run1.id,
          output_type: 'result' as const,
          content: 'First run result'
        },
        {
          run_id: run2.id,
          output_type: 'log' as const,
          content: 'Second run log'
        }
      ])
      .execute();

    // Get the first run
    const result = await getAgentRun(run1.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(run1.id);
    expect(result!.input_text).toEqual('First input');
    expect(result!.status).toEqual('completed');
    expect(result!.completed_at).toBeInstanceOf(Date);
    
    // Should only have outputs for this specific run
    expect(result!.outputs).toHaveLength(1);
    expect(result!.outputs[0].content).toEqual('First run result');
    expect(result!.outputs[0].output_type).toEqual('result');
  });

  it('should handle run with error output type', async () => {
    // Create test agent
    const agentResult = await db.insert(agentsTable)
      .values({
        name: 'Test Agent',
        description: 'Test agent description',
        role: 'test_role',
        goal: 'test goal',
        backstory: 'test backstory',
        is_active: true
      })
      .returning()
      .execute();

    const agent = agentResult[0];

    // Create failed run
    const runResult = await db.insert(agentRunsTable)
      .values({
        agent_id: agent.id,
        input_text: 'Failing input',
        status: 'failed',
        started_at: new Date(),
        completed_at: new Date()
      })
      .returning()
      .execute();

    const run = runResult[0];

    // Create error output
    await db.insert(agentOutputsTable)
      .values({
        run_id: run.id,
        output_type: 'error' as const,
        content: 'Task failed with error: Connection timeout'
      })
      .execute();

    // Get the run
    const result = await getAgentRun(run.id);

    expect(result).not.toBeNull();
    expect(result!.status).toEqual('failed');
    expect(result!.outputs).toHaveLength(1);
    expect(result!.outputs[0].output_type).toEqual('error');
    expect(result!.outputs[0].content).toEqual('Task failed with error: Connection timeout');
  });
});