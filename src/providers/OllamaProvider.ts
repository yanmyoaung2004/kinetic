import ollama from "ollama";
import { ChatMessage, LLMProvider, LLMResponse } from "../types/BaseLLM";
import { ToolDefinition } from "../types/Agent";

export class OllamaProvider extends LLMProvider {
  /**
   * @param model The local model name. Ensure you have run `ollama pull <model>` first.
   */
  constructor(model: string = "llama3") {
    // We default to llama3 as llama2 is significantly outdated in 2026.
    super(model);
  }

  /**
   * Generates a response using the local Ollama instance.
   * Note: This assumes Ollama is running on the default port 11434.
   */
  async generate(messages: ChatMessage[]): Promise<LLMResponse> {
    try {
      const response = await ollama.chat({
        model: this.model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content:
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content),
        })),
        stream: false,
        think: false,
      });

      const content = response.message.content;

      if (!content) {
        throw new Error(
          `Ollama Model [${this.model}] returned an empty string.`,
        );
      }

      return {
        content: content,
        tool_calls: [],
        role: response.message.role,
      };
    } catch (error: any) {
      // Diagnostic check: Is Ollama actually running?
      if (
        error.message.includes("fetch failed") ||
        error.code === "ECONNREFUSED"
      ) {
        throw new Error(
          "Ollama Connection Error: Is the Ollama app running on your machine?",
        );
      }

      console.error("Ollama Local Error:");
      throw error;
    }
  }

  async generateWithTools(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
  ): Promise<LLMResponse> {
    try {
      return this.generate(messages);
    } catch (error: any) {
      throw new Error(`Ollama_GENERATION_FAILED: ${error.message}`);
    }
  }
}
