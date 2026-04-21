import OpenAI from "openai";
import { BaseLLM, ChatMessage } from "../types/BaseLLM";

/**
 * A universal provider for any service that follows the OpenAI API schema.
 * Works with: DeepSeek, Perplexity, Gemini (v1beta/openai), Groq, etc.
 */
export class OpenAICompatibleProvider extends BaseLLM {
  private client: OpenAI;

  constructor(apiKey: string | undefined, baseURL: string, model: string) {
    super(model);

    if (!apiKey) {
      throw new Error(
        `Auth Error: API Key is required for endpoint [${baseURL}]`,
      );
    }

    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL, // The "secret sauce" for compatibility
    });
  }

  async generate(messages: ChatMessage[]): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as any,
      });

      return response.choices[0]?.message?.content || "";
    } catch (error: any) {
      console.error(`Provider [${this.model}] failed:`, error?.message);
      throw error;
    }
  }
}
