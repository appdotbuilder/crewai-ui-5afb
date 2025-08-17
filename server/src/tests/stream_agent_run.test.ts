import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agentsTable, agentRunsTable, agentOutputsTable } from '../db/schema';
import { streamAgentRun } from '../handlers/stream_agent_run';
import { eq } from 'drizzle-orm';

// Test data
const testAgent = {
  name: 'Test Agent',
  description: 'Agent for testing',
  role: 'Tester',
  goal: 'Test streaming functionality',
  backstory: 'Created for testing purposes',
  is_active: true
};

const testRun = {
  input_text: 'Test input for streaming',
  status: 'pending' as const
};

describe('streamAgentRun', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should throw error for non-existent run', async () => {
    const stream = streamAgentRun(999);
    
    await expect(stream.next()).rejects.toThrow(/Agent run with ID 999 not found/i);
  });

  it('should stream all outputs for completed run', async () => {
    // Create agent
    const [agent] = await db.insert(agentsTable)
      .values(testAgent)
      .returning()
      .execute();

    // Create completed run
    const [run] = await db.insert(agentRunsTable)
      .values({
        ...testRun,
        agent_id: agent.id,
        status: 'completed',
        started_at: new Date(),
        completed_at: new Date()
      })
      .returning()
      .execute();

    // Create some outputs
    await db.insert(agentOutputsTable)
      .values([
        {
          run_id: run.id,
          output_type: 'log',
          content: 'Starting process...',
          timestamp: new Date()
        },
        {
          run_id: run.id,
          output_type: 'result',
          content: 'Process completed successfully',
          timestamp: new Date()
        }
      ])
      .execute();

    // Stream the results
    const events = [];
    const stream = streamAgentRun(run.id);

    for await (const event of stream) {
      events.push(event);
      // Prevent infinite loop in tests
      if (events.length > 10) break;
    }

    // Should have 2 output events + 1 complete event
    expect(events).toHaveLength(3);

    // First two should be outputs
    expect(events[0].type).toEqual('output');
    expect(events[0].run_id).toEqual(run.id);
    expect(events[0].data).toMatchObject({
      output_type: 'log',
      content: 'Starting process...'
    });

    expect(events[1].type).toEqual('output');
    expect(events[1].run_id).toEqual(run.id);
    expect(events[1].data).toMatchObject({
      output_type: 'result',
      content: 'Process completed successfully'
    });

    // Last should be completion
    expect(events[2].type).toEqual('complete');
    expect(events[2].run_id).toEqual(run.id);
    expect((events[2].data as any).final_result).toEqual('Process completed successfully');
  });

  it('should stream empty completion for run with no outputs', async () => {
    // Create agent
    const [agent] = await db.insert(agentsTable)
      .values(testAgent)
      .returning()
      .execute();

    // Create completed run with no outputs
    const [run] = await db.insert(agentRunsTable)
      .values({
        ...testRun,
        agent_id: agent.id,
        status: 'completed',
        started_at: new Date(),
        completed_at: new Date()
      })
      .returning()
      .execute();

    // Stream the results
    const events = [];
    const stream = streamAgentRun(run.id);

    for await (const event of stream) {
      events.push(event);
      if (events.length > 5) break;
    }

    // Should only have completion event
    expect(events).toHaveLength(1);
    expect(events[0].type).toEqual('complete');
    expect(events[0].run_id).toEqual(run.id);
    expect((events[0].data as any).final_result).toBeUndefined();
  });

  it('should stream status updates and new outputs during run', async () => {
    // Create agent
    const [agent] = await db.insert(agentsTable)
      .values(testAgent)
      .returning()
      .execute();

    // Create pending run
    const [run] = await db.insert(agentRunsTable)
      .values({
        ...testRun,
        agent_id: agent.id,
        status: 'pending'
      })
      .returning()
      .execute();

    // Start streaming in background
    const events: any[] = [];
    const stream = streamAgentRun(run.id);

    // Start collecting events
    const streamPromise = (async () => {
      for await (const event of stream) {
        events.push(event);
        if (event.type === 'complete') break;
        // Safety check to prevent infinite loop
        if (events.length > 20) break;
      }
    })();

    // Simulate run progress with delays
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update status to running
    await db.update(agentRunsTable)
      .set({ 
        status: 'running',
        started_at: new Date()
      })
      .where(eq(agentRunsTable.id, run.id))
      .execute();

    await new Promise(resolve => setTimeout(resolve, 100));

    // Add some outputs
    await db.insert(agentOutputsTable)
      .values({
        run_id: run.id,
        output_type: 'log',
        content: 'Processing started',
        timestamp: new Date()
      })
      .execute();

    await new Promise(resolve => setTimeout(resolve, 100));

    // Add result and complete
    await db.insert(agentOutputsTable)
      .values({
        run_id: run.id,
        output_type: 'result',
        content: 'Task completed',
        timestamp: new Date()
      })
      .execute();

    await db.update(agentRunsTable)
      .set({ 
        status: 'completed',
        completed_at: new Date()
      })
      .where(eq(agentRunsTable.id, run.id))
      .execute();

    // Wait for stream to complete
    await streamPromise;

    // Should have received status update, outputs, and completion
    expect(events.length).toBeGreaterThan(2);

    // Find status update (could be running or completed depending on timing)
    const statusUpdate = events.find(e => e.type === 'status_update');
    expect(statusUpdate).toBeDefined();
    expect(['running', 'completed']).toContain((statusUpdate!.data as any).status);

    // Find outputs
    const outputs = events.filter(e => e.type === 'output');
    expect(outputs.length).toBeGreaterThanOrEqual(2);

    // Find completion
    const completion = events.find(e => e.type === 'complete');
    expect(completion).toBeDefined();
    expect((completion!.data as any).final_result).toEqual('Task completed');
  });

  it('should handle multiple result outputs correctly', async () => {
    // Create agent
    const [agent] = await db.insert(agentsTable)
      .values(testAgent)
      .returning()
      .execute();

    // Create completed run
    const [run] = await db.insert(agentRunsTable)
      .values({
        ...testRun,
        agent_id: agent.id,
        status: 'completed'
      })
      .returning()
      .execute();

    // Create multiple result outputs
    await db.insert(agentOutputsTable)
      .values([
        {
          run_id: run.id,
          output_type: 'result',
          content: 'Result part 1',
          timestamp: new Date()
        },
        {
          run_id: run.id,
          output_type: 'log',
          content: 'Some log message',
          timestamp: new Date()
        },
        {
          run_id: run.id,
          output_type: 'result',
          content: 'Result part 2',
          timestamp: new Date()
        }
      ])
      .execute();

    // Stream the results
    const events = [];
    const stream = streamAgentRun(run.id);

    for await (const event of stream) {
      events.push(event);
      if (events.length > 10) break;
    }

    // Find completion event
    const completion = events.find(e => e.type === 'complete');
    expect(completion).toBeDefined();
    expect((completion!.data as any).final_result).toEqual('Result part 1\nResult part 2');
  });

  it('should handle failed run status', async () => {
    // Create agent
    const [agent] = await db.insert(agentsTable)
      .values(testAgent)
      .returning()
      .execute();

    // Create failed run
    const [run] = await db.insert(agentRunsTable)
      .values({
        ...testRun,
        agent_id: agent.id,
        status: 'failed'
      })
      .returning()
      .execute();

    // Add error output
    await db.insert(agentOutputsTable)
      .values({
        run_id: run.id,
        output_type: 'error',
        content: 'Something went wrong',
        timestamp: new Date()
      })
      .execute();

    // Stream the results
    const events = [];
    const stream = streamAgentRun(run.id);

    for await (const event of stream) {
      events.push(event);
      if (events.length > 5) break;
    }

    // Should have output and completion
    expect(events.length).toBeGreaterThanOrEqual(2);

    const errorOutput = events.find(e => 
      e.type === 'output' && 
      (e.data as any).output_type === 'error'
    );
    expect(errorOutput).toBeDefined();
    expect((errorOutput!.data as any).content).toEqual('Something went wrong');

    const completion = events.find(e => e.type === 'complete');
    expect(completion).toBeDefined();
  });
});