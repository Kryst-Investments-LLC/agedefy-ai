// Adapter that wires the shared @kryst-investments-llc/master-orchestrator
// package to agedefy's local YAML specs under /agents.
//
// Usage:
//   import { getAgentGraph } from "@/lib/orchestrator";
//   const graph = await getAgentGraph();
//   const result = await graph.dispatch({ intent: "user wants drug-supplement interaction prediction" });

import path from "node:path";
import { loadAgentGraph, type AgentGraph } from "@kryst-investments-llc/master-orchestrator/agent-graph";

let cached: Promise<AgentGraph> | null = null;

export function agentsDir(): string {
  return path.resolve(process.cwd(), "agents");
}

export function getAgentGraph(): Promise<AgentGraph> {
  if (!cached) {
    cached = loadAgentGraph(agentsDir(), {
      orchestratorName: "master-orchestrator-agent",
      traceSink: path.resolve(process.cwd(), "traces", "orchestrator.jsonl"),
    });
  }
  return cached;
}

// Optional: register handlers for each agent. In production these would call
// internal API routes / queue jobs / hit Vercel Edge Functions. The
// AgentGraph emits a "warn" trace for any unregistered handler so the system
// degrades gracefully while handlers are still being implemented.
export async function registerDefaultHandlers(graph: AgentGraph): Promise<AgentGraph> {
  // Example placeholder — wire to real handlers as they ship:
  //
  // graph.register("compound-interaction-agent", async ({ intent, payload }) => {
  //   const res = await fetch("/api/agents/compound-interaction", {
  //     method: "POST",
  //     body: JSON.stringify({ intent, payload }),
  //   });
  //   return res.json();
  // });
  return graph;
}
