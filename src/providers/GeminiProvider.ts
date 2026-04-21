import { GoogleGenAI } from "@google/genai";
import { BaseLLM, ChatMessage } from "../types/BaseLLM";

export class GeminiProvider extends BaseLLM {
  private client: GoogleGenAI;

  constructor(
    apiKey: string | undefined,
    model: string = "gemini-3-flash-preview",
  ) {
    // Note: Gemini 3 Flash is the recommended balance of speed and reasoning in 2026
    super(model);

    if (!apiKey && !process.env.GEMINI_API_KEY) {
      throw new Error(
        "Gemini initialization failed: No API key provided or found in environment.",
      );
    }

    // The SDK automatically checks GEMINI_API_KEY if apiKey is undefined here
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(messages: ChatMessage[]): Promise<string> {
    try {
      // Map the common ChatMessage format to Gemini's expected 'contents' format
      const contents = messages.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content as string }],
      }));

      const result = await this.client.models.generateContent({
        model: this.model,
        contents: contents,
        config: {
          temperature: 0.5,
          maxOutputTokens: 1024,
        },
      });

      // The new SDK returns a direct .text property on the response
      const output = result.text;

      if (!output) {
        throw new Error("Gemini returned an empty response.");
      }

      return output;
    } catch (error) {
      console.error("GeminiProvider Error:");
      throw error;
    }
  }
}
