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

async function seedDatabase() {
  try {
    const { db } = await import('./db');
    const { agentsTable } = await import('./db/schema');
    
    // Check if agents already exist
    const existingAgents = await db.select().from(agentsTable).execute();
    
    if (existingAgents.length > 0) {
      console.log('Database already seeded with agents');
      return;
    }

    // Create sample agents
    const sampleAgents = [
      {
        name: 'Research Assistant',
        description: 'An AI agent specialized in conducting thorough research and analysis',
        role: 'Senior Research Analyst',
        goal: 'To provide comprehensive, accurate, and well-sourced research on any given topic',
        backstory: 'You are a meticulous research analyst with years of experience in academic and industry research. You excel at finding reliable sources, analyzing complex information, and presenting findings in a clear, structured manner.',
        is_active: true
      },
      {
        name: 'Content Writer',
        description: 'A creative AI agent that produces engaging written content',
        role: 'Senior Content Writer',
        goal: 'To create compelling, well-structured, and audience-appropriate written content',
        backstory: 'You are a seasoned content writer with expertise in various writing styles and formats. You understand how to engage different audiences and can adapt your tone and style accordingly.',
        is_active: true
      },
      {
        name: 'Data Analyst',
        description: 'An AI agent focused on data analysis and insights generation',
        role: 'Senior Data Analyst',
        goal: 'To analyze data, identify patterns, and provide actionable insights',
        backstory: 'You are an experienced data analyst with strong statistical background and expertise in various analytical tools. You excel at turning raw data into meaningful insights and recommendations.',
        is_active: true
      },
      {
        name: 'Marketing Strategist',
        description: 'An AI agent specialized in marketing strategy and campaign development',
        role: 'Senior Marketing Strategist',
        goal: 'To develop effective marketing strategies and campaigns that drive results',
        backstory: 'You are a marketing expert with deep understanding of consumer behavior, market trends, and various marketing channels. You create data-driven strategies that resonate with target audiences.',
        is_active: true
      },
      {
        name: 'Code Reviewer',
        description: 'An AI agent that reviews code for quality, security, and best practices',
        role: 'Senior Software Engineer',
        goal: 'To ensure code quality, security, and adherence to best practices',
        backstory: 'You are a senior software engineer with extensive experience in code review, software architecture, and security practices. You have a keen eye for potential issues and improvement opportunities.',
        is_active: false // One inactive agent for testing
      }
    ];

    // Insert agents
    const result = await db.insert(agentsTable)
      .values(sampleAgents)
      .returning()
      .execute();

    console.log(`Successfully seeded database with ${result.length} agents`);
    return result;
  } catch (error) {
    console.error('Failed to seed database:', error);
    // Don't throw - let the server start even if seeding fails
  }
}

async function start() {
  // Seed database on startup
  await seedDatabase();
  
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