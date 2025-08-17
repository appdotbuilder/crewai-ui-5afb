import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agentsTable, agentRunsTable, agentOutputsTable } from '../db/schema';
import { getAgentOutputs } from '../handlers/get_agent_outputs';

describe('getAgentOutputs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when run has no outputs', async () => {
    // Create agent first
    const [agent] = await db.insert(agentsTable)
      .values({
        name: 'Test Agent',
        description: 'Test description',
        role: 'tester',
        goal: 'test things',
        backstory: 'testing background',
        is_active: true
      })
      .returning()
      .execute();

    // Create agent run
    const [run] = await db.insert(agentRunsTable)
      .values({
        agent_id: agent.id,
        input_text: 'test input',
        status: 'pending'
      })
      .returning()
      .execute();

    const result = await getAgentOutputs(run.id);

    expect(result).toEqual([]);
  });

  it('should return outputs ordered by timestamp', async () => {
    // Create agent
    const [agent] = await db.insert(agentsTable)
      .values({
        name: 'Test Agent',
        description: 'Test description',
        role: 'tester',
        goal: 'test things',
        backstory: 'testing background',
        is_active: true
      })
      .returning()
      .execute();

    // Create agent run
    const [run] = await db.insert(agentRunsTable)
      .values({
        agent_id: agent.id,
        input_text: 'test input',
        status: 'running'
      })
      .returning()
      .execute();

    // Create outputs with different timestamps
    const now = new Date();
    const earlier = new Date(now.getTime() - 60000); // 1 minute earlier
    const later = new Date(now.getTime() + 60000); // 1 minute later

    await db.insert(agentOutputsTable)
      .values([
        {
          run_id: run.id,
          output_type: 'log',
          content: 'Third output',
          timestamp: later
        },
        {
          run_id: run.id,
          output_type: 'log',
          content: 'First output',
          timestamp: earlier
        },
        {
          run_id: run.id,
          output_type: 'result',
          content: 'Second output',
          timestamp: now
        }
      ])
      .execute();

    const result = await getAgentOutputs(run.id);

    expect(result).toHaveLength(3);
    expect(result[0].content).toBe('First output');
    expect(result[1].content).toBe('Second output');
    expect(result[2].content).toBe('Third output');
    
    // Verify chronological order
    expect(result[0].timestamp <= result[1].timestamp).toBe(true);
    expect(result[1].timestamp <= result[2].timestamp).toBe(true);
  });

  it('should return outputs with all expected fields', async () => {
    // Create agent
    const [agent] = await db.insert(agentsTable)
      .values({
        name: 'Test Agent',
        description: 'Test description',
        role: 'tester',
        goal: 'test things',
        backstory: 'testing background',
        is_active: true
      })
      .returning()
      .execute();

    // Create agent run
    const [run] = await db.insert(agentRunsTable)
      .values({
        agent_id: agent.id,
        input_text: 'test input',
        status: 'running'
      })
      .returning()
      .execute();

    // Create output with explicit timestamp
    const customTimestamp = new Date('2024-01-15T10:00:00Z');
    await db.insert(agentOutputsTable)
      .values({
        run_id: run.id,
        output_type: 'error',
        content: 'Error occurred',
        timestamp: customTimestamp
      })
      .execute();

    const result = await getAgentOutputs(run.id);

    expect(result).toHaveLength(1);
    const output = result[0];
    
    expect(output.id).toBeDefined();
    expect(output.run_id).toBe(run.id);
    expect(output.output_type).toBe('error');
    expect(output.content).toBe('Error occurred');
    expect(output.timestamp).toBeInstanceOf(Date);
    expect(output.timestamp.getTime()).toBe(customTimestamp.getTime());
    expect(output.created_at).toBeInstanceOf(Date);
  });

  it('should handle different output types correctly', async () => {
    // Create agent
    const [agent] = await db.insert(agentsTable)
      .values({
        name: 'Test Agent',
        description: 'Test description',
        role: 'tester',
        goal: 'test things',
        backstory: 'testing background',
        is_active: true
      })
      .returning()
      .execute();

    // Create agent run
    const [run] = await db.insert(agentRunsTable)
      .values({
        agent_id: agent.id,
        input_text: 'test input',
        status: 'running'
      })
      .returning()
      .execute();

    // Create outputs of different types
    await db.insert(agentOutputsTable)
      .values([
        {
          run_id: run.id,
          output_type: 'log',
          content: 'Debug log message'
        },
        {
          run_id: run.id,
          output_type: 'result',
          content: 'Final result data'
        },
        {
          run_id: run.id,
          output_type: 'error',
          content: 'Error message'
        }
      ])
      .execute();

    const result = await getAgentOutputs(run.id);

    expect(result).toHaveLength(3);
    
    const logOutput = result.find(o => o.output_type === 'log');
    const resultOutput = result.find(o => o.output_type === 'result');
    const errorOutput = result.find(o => o.output_type === 'error');

    expect(logOutput?.content).toBe('Debug log message');
    expect(resultOutput?.content).toBe('Final result data');
    expect(errorOutput?.content).toBe('Error message');
  });

  it('should only return outputs for the specified run', async () => {
    // Create agent
    const [agent] = await db.insert(agentsTable)
      .values({
        name: 'Test Agent',
        description: 'Test description',
        role: 'tester',
        goal: 'test things',
        backstory: 'testing background',
        is_active: true
      })
      .returning()
      .execute();

    // Create two agent runs
    const [run1, run2] = await db.insert(agentRunsTable)
      .values([
        {
          agent_id: agent.id,
          input_text: 'first input',
          status: 'running'
        },
        {
          agent_id: agent.id,
          input_text: 'second input',
          status: 'pending'
        }
      ])
      .returning()
      .execute();

    // Create outputs for both runs
    await db.insert(agentOutputsTable)
      .values([
        {
          run_id: run1.id,
          output_type: 'log',
          content: 'Output for run 1'
        },
        {
          run_id: run1.id,
          output_type: 'result',
          content: 'Result for run 1'
        },
        {
          run_id: run2.id,
          output_type: 'log',
          content: 'Output for run 2'
        }
      ])
      .execute();

    const result = await getAgentOutputs(run1.id);

    expect(result).toHaveLength(2);
    result.forEach(output => {
      expect(output.run_id).toBe(run1.id);
    });
    
    expect(result.some(o => o.content.includes('run 1'))).toBe(true);
    expect(result.some(o => o.content.includes('run 2'))).toBe(false);
  });

  it('should handle non-existent run ID gracefully', async () => {
    const result = await getAgentOutputs(999999);
    expect(result).toEqual([]);
  });
});