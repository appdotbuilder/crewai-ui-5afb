import { db } from '../db';
import { agentRunsTable, agentOutputsTable } from '../db/schema';
import { type StreamOutputEvent } from '../schema';
import { eq, gt, desc, and } from 'drizzle-orm';

export async function* streamAgentRun(runId: number): AsyncGenerator<StreamOutputEvent> {
  try {
    // Verify the run exists
    const run = await db.select()
      .from(agentRunsTable)
      .where(eq(agentRunsTable.id, runId))
      .execute();

    if (run.length === 0) {
      throw new Error(`Agent run with ID ${runId} not found`);
    }

    let lastOutputId = 0;
    let lastStatus = run[0].status;
    let isComplete = lastStatus === 'completed' || lastStatus === 'failed';

    // If already complete, stream all existing outputs and complete
    if (isComplete) {
      const allOutputs = await db.select()
        .from(agentOutputsTable)
        .where(eq(agentOutputsTable.run_id, runId))
        .orderBy(agentOutputsTable.id)
        .execute();

      for (const output of allOutputs) {
        yield {
          type: 'output',
          run_id: runId,
          data: {
            id: output.id,
            run_id: output.run_id,
            output_type: output.output_type,
            content: output.content,
            timestamp: output.timestamp,
            created_at: output.created_at
          }
        };
      }

      yield {
        type: 'complete',
        run_id: runId,
        data: {
          final_result: allOutputs
            .filter(o => o.output_type === 'result')
            .map(o => o.content)
            .join('\n') || undefined
        }
      };
      return;
    }

    // Poll for updates until completion
    while (!isComplete) {
      // Check for new outputs
      const conditions = [eq(agentOutputsTable.run_id, runId)];
      
      // Filter by ID if we've seen outputs before
      if (lastOutputId > 0) {
        conditions.push(gt(agentOutputsTable.id, lastOutputId));
      }

      const filteredOutputs = await db.select()
        .from(agentOutputsTable)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(agentOutputsTable.id)
        .execute();

      // Yield new outputs
      for (const output of filteredOutputs) {
        yield {
          type: 'output',
          run_id: runId,
          data: {
            id: output.id,
            run_id: output.run_id,
            output_type: output.output_type,
            content: output.content,
            timestamp: output.timestamp,
            created_at: output.created_at
          }
        };
        lastOutputId = output.id;
      }

      // Check for status updates
      const currentRun = await db.select()
        .from(agentRunsTable)
        .where(eq(agentRunsTable.id, runId))
        .execute();

      if (currentRun.length === 0) {
        throw new Error(`Agent run with ID ${runId} was deleted`);
      }

      const currentStatus = currentRun[0].status;
      
      // Yield status update if changed
      if (currentStatus !== lastStatus) {
        yield {
          type: 'status_update',
          run_id: runId,
          data: { status: currentStatus }
        };
        lastStatus = currentStatus;
      }

      // Check if completed
      isComplete = currentStatus === 'completed' || currentStatus === 'failed';

      if (isComplete) {
        // Get final results
        const finalOutputs = await db.select()
          .from(agentOutputsTable)
          .where(eq(agentOutputsTable.run_id, runId))
          .execute();

        const finalResult = finalOutputs
          .filter(o => o.output_type === 'result')
          .map(o => o.content)
          .join('\n') || undefined;

        yield {
          type: 'complete',
          run_id: runId,
          data: { final_result: finalResult }
        };
        break;
      }

      // Wait before next poll (1 second)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Agent run streaming failed:', error);
    throw error;
  }
}