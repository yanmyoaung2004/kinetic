import { ToolDefinition } from "./Agent";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | any[];
};

export interface LLMResponse {
  content: string | null;
  tool_calls?: any[];
  role: string;
}

export abstract class LLMProvider {
  protected model: string;

  constructor(model: string) {
    this.model = model;
  }
  abstract generate(messages: ChatMessage[]): Promise<LLMResponse>;
  abstract generateWithTools(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
  ): Promise<LLMResponse>;
}
