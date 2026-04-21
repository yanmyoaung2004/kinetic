import OpenAI from "openai";
import { BaseLLM, ChatMessage } from "../types/BaseLLM";

export class OpenAIProvider extends BaseLLM {
  private client: OpenAI;

  constructor(apiKey: string | undefined, model: string = "gpt-4o") {
    super(model);
    if (!apiKey) throw new Error("OpenAI API Key is missing.");
    this.client = new OpenAI({ apiKey });
  }

  async generate(messages: ChatMessage[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages as any, // Cast for SDK compatibility
    });
    return response.choices[0]?.message?.content || "";
  }
}
