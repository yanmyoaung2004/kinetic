import OpenAI from "openai";
import { ChatMessage, LLMProvider, LLMResponse } from "../types/BaseLLM";
import { ToolDefinition } from "../types/Agent";

export class OpenRouterProvider extends LLMProvider {
  private client: any; // The SDK type definitions can be strict, 'any' allows for flexible model routing

  constructor(
    apiKey: string | undefined,
    model: string = "openai/gpt-4o",
    siteUrl?: string,
    siteName?: string,
  ) {
    super(model);

    if (!apiKey) {
      throw new Error("OpenRouter initialization failed: API Key is missing.");
    }
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: apiKey,
      defaultHeaders: {
        "HTTP-Referer": siteName || "http://localhost",
        "X-OpenRouter-Title": "K.I.N.E.T.I.C. Dev Environment",
      },
    });
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

  async generate(messages: ChatMessage[]): Promise<LLMResponse> {
    try {
      // OpenRouter's 'chat.send' is their standard for non-streaming completions
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
      });
      const content = response.choices?.[0]?.message;
      if (!content) {
        throw new Error(
          `OpenRouter returned an empty response for model: ${this.model}`,
        );
      }
      return content;
    } catch (error) {
      console.error("OpenRouterProvider Error:");
      throw error;
    }
  }
}
