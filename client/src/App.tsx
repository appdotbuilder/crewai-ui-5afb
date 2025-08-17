import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Agent, AgentRun, AgentOutput, StartAgentRunInput, StreamOutputEvent } from '../../server/src/schema';

function App() {
  // State management
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [inputText, setInputText] = useState('');
  const [currentRun, setCurrentRun] = useState<AgentRun | null>(null);
  const [outputs, setOutputs] = useState<AgentOutput[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Ref to track the current subscription for cleanup
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Load agents on component mount
  const loadAgents = useCallback(async () => {
    try {
      const result = await trpc.getAgents.query();
      setAgents(result);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Cleanup subscription on component unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, []);

  // Get selected agent details
  const selectedAgent = agents.find(agent => agent.id === selectedAgentId);

  // Handle stream events from subscription
  const handleStreamEvent = useCallback((event: StreamOutputEvent) => {
    switch (event.type) {
      case 'output':
        // Add new output to the list
        const outputData = event.data as AgentOutput;
        setOutputs((prev: AgentOutput[]) => [...prev, outputData]);
        break;

      case 'status_update':
        // Update the current run status
        const statusData = event.data as { status: AgentRun['status'] };
        setCurrentRun((prev: AgentRun | null) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: statusData.status,
            // Update timestamps based on status
            started_at: statusData.status === 'running' ? new Date() : prev.started_at,
            completed_at: (statusData.status === 'completed' || statusData.status === 'failed') 
              ? new Date() 
              : prev.completed_at
          };
        });
        break;

      case 'complete':
        // Mark as no longer running
        setIsRunning(false);
        
        // Clean up the subscription
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
          subscriptionRef.current = null;
        }
        break;

      default:
        console.warn('Unknown stream event type:', event);
    }
  }, []);

  // Start streaming after agent run is created
  const startStreaming = useCallback((runId: number) => {
    // Clean up any existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    try {
      // Create subscription to stream agent run
      const subscription = trpc.streamAgentRun.subscribe(
        { runId },
        {
          onData: handleStreamEvent,
          onError: (error) => {
            console.error('Streaming error:', error);
            setIsRunning(false);
          }
        }
      );

      // Store subscription reference for cleanup
      subscriptionRef.current = subscription;
    } catch (error) {
      console.error('Failed to start streaming:', error);
      setIsRunning(false);
    }
  }, [handleStreamEvent]);

  // Start agent run
  const handleStartRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId || !inputText.trim()) return;

    // Clean up any existing subscription before starting a new run
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    setIsLoading(true);
    try {
      const runInput: StartAgentRunInput = {
        agent_id: selectedAgentId,
        input_text: inputText.trim()
      };

      const run = await trpc.startAgentRun.mutate(runInput);
      setCurrentRun(run);
      setOutputs([]);
      setIsRunning(true);
      
      // Start streaming the agent run
      startStreaming(run.id);
    } catch (error) {
      console.error('Failed to start agent run:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get status badge color
  const getStatusColor = (status: AgentRun['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'running': return 'bg-blue-500 animate-pulse';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Get output type styling
  const getOutputTypeStyle = (type: AgentOutput['output_type']) => {
    switch (type) {
      case 'log': return 'text-gray-600 bg-gray-50';
      case 'result': return 'text-green-700 bg-green-50 font-medium';
      case 'error': return 'text-red-700 bg-red-50 font-medium';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent mb-2">
            🤖 CrewAI Agent Dashboard
          </h1>
          <p className="text-gray-600">
            Select an agent, provide input, and watch your AI crew in action!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Agent Selection & Input */}
          <div className="space-y-6">
            {/* Agent Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  👥 Select Agent
                </CardTitle>
                <CardDescription>
                  Choose from available CrewAI agents
                </CardDescription>
              </CardHeader>
              <CardContent>
                {agents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-lg mb-2">🔍 No agents found</p>
                    <p className="text-sm">
                      No agents are currently available. Please check your backend setup.
                    </p>
                  </div>
                ) : (
                  <Select
                    value={selectedAgentId?.toString() || ''}
                    onValueChange={(value) => setSelectedAgentId(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent: Agent) => (
                        <SelectItem key={agent.id} value={agent.id.toString()}>
                          <div className="flex items-center gap-2">
                            <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                              {agent.is_active ? '🟢 Active' : '🔴 Inactive'}
                            </Badge>
                            {agent.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>

            {/* Agent Details */}
            {selectedAgent && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🎯 {selectedAgent.name}
                  </CardTitle>
                  <CardDescription>
                    {selectedAgent.description || 'No description available'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <strong className="text-sm text-gray-600">Role:</strong>
                    <p className="text-sm">{selectedAgent.role}</p>
                  </div>
                  <div>
                    <strong className="text-sm text-gray-600">Goal:</strong>
                    <p className="text-sm">{selectedAgent.goal}</p>
                  </div>
                  <div>
                    <strong className="text-sm text-gray-600">Backstory:</strong>
                    <p className="text-sm">{selectedAgent.backstory}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Input Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  💬 Agent Input
                </CardTitle>
                <CardDescription>
                  Provide instructions or questions for your agent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleStartRun} className="space-y-4">
                  <Textarea
                    placeholder="Enter your message or task for the agent..."
                    value={inputText}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                      setInputText(e.target.value)
                    }
                    rows={4}
                    disabled={isRunning}
                  />
                  <Button 
                    type="submit" 
                    disabled={!selectedAgentId || !inputText.trim() || isLoading || isRunning}
                    className="w-full"
                  >
                    {isLoading ? (
                      '🔄 Starting...'
                    ) : isRunning ? (
                      '⏳ Running...'
                    ) : (
                      '🚀 Start Agent'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Agent Output */}
          <div className="space-y-6">
            {/* Run Status */}
            {currentRun && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      📊 Run Status
                    </span>
                    <Badge className={getStatusColor(currentRun.status)}>
                      {currentRun.status.toUpperCase()}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Run #{currentRun.id} • Started {currentRun.created_at.toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm space-y-1">
                    <p><strong>Input:</strong> {currentRun.input_text}</p>
                    {currentRun.started_at && (
                      <p><strong>Started:</strong> {currentRun.started_at.toLocaleString()}</p>
                    )}
                    {currentRun.completed_at && (
                      <p><strong>Completed:</strong> {currentRun.completed_at.toLocaleString()}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Agent Output */}
            <Card className="flex-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📝 Agent Output
                </CardTitle>
                <CardDescription>
                  Real-time logs and results from your agent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96 w-full rounded-md border p-4">
                  {outputs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {currentRun ? (
                        isRunning ? (
                          <div className="space-y-2">
                            <p className="text-lg">⏳ Waiting for output...</p>
                            <p className="text-sm">Your agent is processing your request</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-lg">🔍 No output yet</p>
                            <p className="text-sm">The agent run has no output available</p>
                          </div>
                        )
                      ) : (
                        <div className="space-y-2">
                          <p className="text-lg">👋 Ready to start!</p>
                          <p className="text-sm">Select an agent and provide input to see results here</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {outputs.map((output: AgentOutput) => (
                        <div 
                          key={output.id} 
                          className={`p-3 rounded-lg border-l-4 ${getOutputTypeStyle(output.output_type)}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="text-xs">
                              {output.output_type.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {output.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <pre className="whitespace-pre-wrap text-sm font-mono">
                            {output.content}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>
            💡 This dashboard interfaces with your CrewAI agents through tRPC. 
            Make sure your backend handlers are properly implemented for full functionality.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;