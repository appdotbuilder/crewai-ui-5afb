import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agentsTable, agentRunsTable, agentOutputsTable } from '../db/schema';
import { type CreateAgentOutputInput } from '../schema';
import { createAgentOutput } from '../handlers/create_agent_output';
import { eq } from 'drizzle-orm';

describe('createAgentOutput', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testAgentId: number;
  let testRunId: number;

  beforeEach(async () => {
    // Create prerequisite agent first
    const agentResult = await db.insert(agentsTable)
      .values({
        name: 'Test Agent',
        description: 'Agent for testing',
        role: 'Tester',
        goal: 'Test things',
        backstory: 'Created for testing',
        is_active: true
      })
      .returning()
      .execute();

    testAgentId = agentResult[0].id;

    // Create prerequisite agent run
    const runResult = await db.insert(agentRunsTable)
      .values({
        agent_id: testAgentId,
        input_text: 'Test input',
        status: 'running'
      })
      .returning()
      .execute();

    testRunId = runResult[0].id;
  });

  it('should create agent output with log type', async () => {
    const testInput: CreateAgentOutputInput = {
      run_id: testRunId,
      output_type: 'log',
      content: 'This is a test log message'
    };

    const result = await createAgentOutput(testInput);

    // Basic field validation
    expect(result.run_id).toEqual(testRunId);
    expect(result.output_type).toEqual('log');
    expect(result.content).toEqual('This is a test log message');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create agent output with result type', async () => {
    const testInput: CreateAgentOutputInput = {
      run_id: testRunId,
      output_type: 'result',
      content: 'Final result of the agent execution'
    };

    const result = await createAgentOutput(testInput);

    expect(result.run_id).toEqual(testRunId);
    expect(result.output_type).toEqual('result');
    expect(result.content).toEqual('Final result of the agent execution');
    expect(result.id).toBeDefined();
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create agent output with error type', async () => {
    const testInput: CreateAgentOutputInput = {
      run_id: testRunId,
      output_type: 'error',
      content: 'An error occurred during execution'
    };

    const result = await createAgentOutput(testInput);

    expect(result.run_id).toEqual(testRunId);
    expect(result.output_type).toEqual('error');
    expect(result.content).toEqual('An error occurred during execution');
    expect(result.id).toBeDefined();
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should use provided timestamp when specified', async () => {
    const customTimestamp = new Date('2024-01-15T10:30:00.000Z');
    const testInput: CreateAgentOutputInput = {
      run_id: testRunId,
      output_type: 'log',
      content: 'Timestamped log message',
      timestamp: customTimestamp
    };

    const result = await createAgentOutput(testInput);

    expect(result.timestamp).toEqual(customTimestamp);
    expect(result.content).toEqual('Timestamped log message');
  });

  it('should default timestamp to current time when not provided', async () => {
    const beforeCreation = new Date();
    
    const testInput: CreateAgentOutputInput = {
      run_id: testRunId,
      output_type: 'log',
      content: 'Log without explicit timestamp'
    };

    const result = await createAgentOutput(testInput);
    const afterCreation = new Date();

    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.timestamp.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
  });

  it('should save agent output to database', async () => {
    const testInput: CreateAgentOutputInput = {
      run_id: testRunId,
      output_type: 'log',
      content: 'Database persistence test'
    };

    const result = await createAgentOutput(testInput);

    // Query database to verify persistence
    const outputs = await db.select()
      .from(agentOutputsTable)
      .where(eq(agentOutputsTable.id, result.id))
      .execute();

    expect(outputs).toHaveLength(1);
    expect(outputs[0].run_id).toEqual(testRunId);
    expect(outputs[0].output_type).toEqual('log');
    expect(outputs[0].content).toEqual('Database persistence test');
    expect(outputs[0].timestamp).toBeInstanceOf(Date);
    expect(outputs[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle multiple outputs for the same run', async () => {
    const testInputs: CreateAgentOutputInput[] = [
      {
        run_id: testRunId,
        output_type: 'log',
        content: 'First log message'
      },
      {
        run_id: testRunId,
        output_type: 'log',
        content: 'Second log message'
      },
      {
        run_id: testRunId,
        output_type: 'result',
        content: 'Final result'
      }
    ];

    // Create multiple outputs
    const results = await Promise.all(
      testInputs.map(input => createAgentOutput(input))
    );

    expect(results).toHaveLength(3);
    
    // Verify all outputs have different IDs but same run_id
    const ids = results.map(r => r.id);
    expect(new Set(ids).size).toEqual(3); // All different IDs
    
    results.forEach(result => {
      expect(result.run_id).toEqual(testRunId);
    });

    // Verify database has all outputs
    const dbOutputs = await db.select()
      .from(agentOutputsTable)
      .where(eq(agentOutputsTable.run_id, testRunId))
      .execute();

    expect(dbOutputs).toHaveLength(3);
  });

  it('should handle long content text', async () => {
    const longContent = 'A'.repeat(10000); // Very long content
    const testInput: CreateAgentOutputInput = {
      run_id: testRunId,
      output_type: 'log',
      content: longContent
    };

    const result = await createAgentOutput(testInput);

    expect(result.content).toEqual(longContent);
    expect(result.content.length).toEqual(10000);
  });
});