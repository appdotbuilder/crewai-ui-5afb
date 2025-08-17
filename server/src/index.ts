import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  createAgentInputSchema, 
  updateAgentInputSchema, 
  startAgentRunInputSchema,
  updateAgentRunInputSchema,
  createAgentOutputInputSchema
} from './schema';

// Import handlers
import { createAgent } from './handlers/create_agent';
import { getAgents } from './handlers/get_agents';
import { getAgentById } from './handlers/get_agent_by_id';
import { updateAgent } from './handlers/update_agent';
import { startAgentRun } from './handlers/start_agent_run';
import { getAgentRun } from './handlers/get_agent_run';
import { getAgentRuns } from './handlers/get_agent_runs';
import { updateAgentRunStatus } from './handlers/update_agent_run_status';
import { createAgentOutput } from './handlers/create_agent_output';
import { getAgentOutputs } from './handlers/get_agent_outputs';
import { streamAgentRun } from './handlers/stream_agent_run';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Agent management routes
  createAgent: publicProcedure
    .input(createAgentInputSchema)
    .mutation(({ input }) => createAgent(input)),
    
  getAgents: publicProcedure
    .query(() => getAgents()),
    
  getAgentById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getAgentById(input.id)),
    
  updateAgent: publicProcedure
    .input(updateAgentInputSchema)
    .mutation(({ input }) => updateAgent(input)),

  // Agent run management routes
  startAgentRun: publicProcedure
    .input(startAgentRunInputSchema)
    .mutation(({ input }) => startAgentRun(input)),
    
  getAgentRun: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getAgentRun(input.id)),
    
  getAgentRuns: publicProcedure
    .input(z.object({ agentId: z.number().optional() }))
    .query(({ input }) => getAgentRuns(input.agentId)),
    
  updateAgentRunStatus: publicProcedure
    .input(updateAgentRunInputSchema)
    .mutation(({ input }) => updateAgentRunStatus(input)),

  // Agent output management routes
  createAgentOutput: publicProcedure
    .input(createAgentOutputInputSchema)
    .mutation(({ input }) => createAgentOutput(input)),
    
  getAgentOutputs: publicProcedure
    .input(z.object({ runId: z.number() }))
    .query(({ input }) => getAgentOutputs(input.runId)),

  // Streaming route for real-time agent execution
  streamAgentRun: publicProcedure
    .input(z.object({ runId: z.number() }))
    .subscription(({ input }) => streamAgentRun(input.runId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();