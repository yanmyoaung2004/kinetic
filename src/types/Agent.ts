export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string; // Used for tool responses
  tool_call_id?: string;
  tool_calls?: any[]; // For assistant tool requests
}

export interface AgentCard {
  id: string;
  systemPrompt: string;
  provider: string;
  model: string;
  type: "library" | "ephemeral";
  parentId?: string;
  apiKey: string;
  can_delegate: boolean;
}

export interface IAgent {
  id: string;
  config: AgentCard;
  process(
    message: string,
    context: any[],
    toolRequired: boolean,
    currentDepth?: number,
  ): Promise<string>;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface UnifiedRoutingDecision {
  needMemory: boolean;
  targetAgent: string[];
  executionMode: "SEQUENTIAL" | "PARALLEL" | string;
  directAnswer: string | null;
  toolRequired: boolean;
}
