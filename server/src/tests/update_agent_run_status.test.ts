import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agentsTable, agentRunsTable } from '../db/schema';
import { type UpdateAgentRunInput } from '../schema';
import { updateAgentRunStatus } from '../handlers/update_agent_run_status';
import { eq } from 'drizzle-orm';

describe('updateAgentRunStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testAgentId: number;
  let testRunId: number;

  beforeEach(async () => {
    // Create a test agent first
    const agentResult = await db.insert(agentsTable)
      .values({
        name: 'Test Agent',
        description: 'Test agent for run status updates',
        role: 'Test Role',
        goal: 'Test goal',
        backstory: 'Test backstory',
        is_active: true
      })
      .returning()
      .execute();
    
    testAgentId = agentResult[0].id;

    // Create a test agent run
    const runResult = await db.insert(agentRunsTable)
      .values({
        agent_id: testAgentId,
        input_text: 'Test input',
        status: 'pending'
      })
      .returning()
      .execute();
    
    testRunId = runResult[0].id;
  });

  it('should update agent run status from pending to running', async () => {
    const input: UpdateAgentRunInput = {
      id: testRunId,
      status: 'running'
    };

    const result = await updateAgentRunStatus(input);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(testRunId);
    expect(result!.status).toEqual('running');
    expect(result!.started_at).toBeInstanceOf(Date);
    expect(result!.completed_at).toBeNull();
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should update agent run status from running to completed', async () => {
    // First set to running
    await updateAgentRunStatus({
      id: testRunId,
      status: 'running'
    });

    const input: UpdateAgentRunInput = {
      id: testRunId,
      status: 'completed'
    };

    const result = await updateAgentRunStatus(input);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(testRunId);
    expect(result!.status).toEqual('completed');
    expect(result!.started_at).toBeInstanceOf(Date);
    expect(result!.completed_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should update agent run status from running to failed', async () => {
    // First set to running
    await updateAgentRunStatus({
      id: testRunId,
      status: 'running'
    });

    const input: UpdateAgentRunInput = {
      id: testRunId,
      status: 'failed'
    };

    const result = await updateAgentRunStatus(input);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(testRunId);
    expect(result!.status).toEqual('failed');
    expect(result!.started_at).toBeInstanceOf(Date);
    expect(result!.completed_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should accept custom started_at timestamp', async () => {
    const customStartTime = new Date('2024-01-01T10:00:00Z');
    
    const input: UpdateAgentRunInput = {
      id: testRunId,
      status: 'running',
      started_at: customStartTime
    };

    const result = await updateAgentRunStatus(input);

    expect(result).not.toBeNull();
    expect(result!.status).toEqual('running');
    expect(result!.started_at).toEqual(customStartTime);
  });

  it('should accept custom completed_at timestamp', async () => {
    const customCompletedTime = new Date('2024-01-01T11:00:00Z');
    
    const input: UpdateAgentRunInput = {
      id: testRunId,
      status: 'completed',
      completed_at: customCompletedTime
    };

    const result = await updateAgentRunStatus(input);

    expect(result).not.toBeNull();
    expect(result!.status).toEqual('completed');
    expect(result!.completed_at).toEqual(customCompletedTime);
  });

  it('should accept null timestamps when provided', async () => {
    const input: UpdateAgentRunInput = {
      id: testRunId,
      status: 'pending',
      started_at: null,
      completed_at: null
    };

    const result = await updateAgentRunStatus(input);

    expect(result).not.toBeNull();
    expect(result!.status).toEqual('pending');
    expect(result!.started_at).toBeNull();
    expect(result!.completed_at).toBeNull();
  });

  it('should return null for non-existent agent run', async () => {
    const input: UpdateAgentRunInput = {
      id: 99999, // Non-existent ID
      status: 'running'
    };

    const result = await updateAgentRunStatus(input);

    expect(result).toBeNull();
  });

  it('should update the database record correctly', async () => {
    const input: UpdateAgentRunInput = {
      id: testRunId,
      status: 'completed'
    };

    await updateAgentRunStatus(input);

    // Query the database directly to verify the update
    const updatedRun = await db.select()
      .from(agentRunsTable)
      .where(eq(agentRunsTable.id, testRunId))
      .execute();

    expect(updatedRun).toHaveLength(1);
    expect(updatedRun[0].status).toEqual('completed');
    expect(updatedRun[0].completed_at).toBeInstanceOf(Date);
    expect(updatedRun[0].updated_at).toBeInstanceOf(Date);
  });

  it('should preserve existing timestamps when not changing status type', async () => {
    // First set to running to establish started_at
    const firstUpdate = await updateAgentRunStatus({
      id: testRunId,
      status: 'running'
    });

    const originalStartedAt = firstUpdate!.started_at;

    // Update to running again (should preserve started_at)
    const secondUpdate = await updateAgentRunStatus({
      id: testRunId,
      status: 'running'
    });

    expect(secondUpdate!.started_at).toEqual(originalStartedAt);
    expect(secondUpdate!.completed_at).toBeNull();
  });

  it('should handle status transitions correctly', async () => {
    // pending -> running
    const runningResult = await updateAgentRunStatus({
      id: testRunId,
      status: 'running'
    });

    expect(runningResult!.status).toEqual('running');
    expect(runningResult!.started_at).toBeInstanceOf(Date);
    expect(runningResult!.completed_at).toBeNull();

    // running -> completed
    const completedResult = await updateAgentRunStatus({
      id: testRunId,
      status: 'completed'
    });

    expect(completedResult!.status).toEqual('completed');
    expect(completedResult!.started_at).toBeInstanceOf(Date);
    expect(completedResult!.completed_at).toBeInstanceOf(Date);
    expect(completedResult!.completed_at! >= completedResult!.started_at!).toBe(true);
  });
});