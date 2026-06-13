// Adapter that wires the shared @kryst-investments-llc/master-orchestrator
// package to this platform's local YAML specs under /agents.
//
// Usage:
//   import { getAgentGraph } from "./lib/orchestrator";
//   const graph = await getAgentGraph();
//   const result = await graph.dispatch({ intent: "<natural language intent>" });

import path from 'node:path';
import { loadAgentGraph } from '@kryst-investments-llc/master-orchestrator';

type AgentGraph = {
  register: (name: string, handler: (ctx: { intent: string; payload?: unknown }) => Promise<unknown>) => void;
  dispatch: (input: { intent: string; payload?: unknown }) => Promise<unknown>;
  list: () => string[];
};

let cached: Promise<AgentGraph> | null = null;

export function agentsDir(): string {
  return path.resolve(process.cwd(), 'agents');
}

export function getAgentGraph(): Promise<AgentGraph> {
  if (!cached) {
    cached = loadAgentGraph(agentsDir(), {
      orchestratorName: 'master-orchestrator-agent',
      traceSink: path.resolve(process.cwd(), 'traces', 'orchestrator.jsonl'),
    }) as Promise<AgentGraph>;
  }
  return cached;
}

export async function registerDefaultHandlers(graph: AgentGraph): Promise<AgentGraph> {
  // Wire platform-specific handlers here as they ship.
  // graph.register("some-agent", async ({ intent, payload }) => { ... });
  return graph;
}
