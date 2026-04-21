import { LLMProvider, LLMResponse, ChatMessage } from "./../types/BaseLLM";
import Groq from "groq-sdk";
import { ToolDefinition } from "../types/Agent";
import {
  availableFunctions,
  calculate,
  execute,
  killProcess,
  startBackground,
} from "../agents/tools/tools";

export class GroqProvider extends LLMProvider {
  private client: Groq;
  public model: string;
  private readonly MAX_ITERATIONS = 3;

  constructor(apiKey: string, model: string = "llama-3.1-8b-instant") {
    super(model); // Always first
    if (!apiKey) throw new Error("CRITICAL ERROR: Groq API Key is missing.");
    this.client = new Groq({ apiKey });
    this.model = model;
  }

  async generateWithTools(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
  ): Promise<LLMResponse> {
    try {
      // let iterations = 0;
      // while (iterations < this.MAX_ITERATIONS) {
      //   const isLastAttempt = iterations === this.MAX_ITERATIONS;

      //   iterations++;
      // }
      const response = await this.client.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: messages as any,
        tools: tools && tools.length > 0 ? (tools as any) : undefined,
        tool_choice: tools && tools.length > 0 ? "auto" : undefined,
        max_tokens: 4096,
        temperature: 0.2,
        parallel_tool_calls: true,
      });
      const responseMessage = response.choices[0].message;
      const toolCalls = responseMessage.tool_calls || [];

      messages.push(responseMessage as any);

      const toolCallResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          const functionName = toolCall.function.name;
          // if (functionName === "spawn_specialist") {
          //   const args = JSON.parse(toolCall.function.arguments);

          //   console.log(
          //     `[${this.id}] -> Spawning Specialist: ${args.name} using ${args.model}`,
          //   );

          //   try {
          //     const subId = await this.dispatcher.createSubAgent(this.id, {
          //       name: args.name,
          //       soul: args.soul,
          //       model: args.model,
          //     });

          //     const specialistResult = await this.dispatcher.dispatch(
          //       subId,
          //       args.task,
          //       context,
          //       false,
          //       currentDepth + 1,
          //     );

          //     this.history.push({
          //       role: "tool",
          //       tool_call_id: toolCall.id,
          //       name: toolCall.function.name,
          //       content: `REPORT FROM ${args.name}: ${specialistResult}`,
          //     });

          //     this.history.push({
          //       role: "system",
          //       content:
          //         "You have received the specialist's data. Do not delegate again. Construct the final technical response now.",
          //     });
          //   } catch (error: any) {
          //     this.history.push({
          //       role: "tool",
          //       tool_call_id: toolCall.id,
          //       name: toolCall.function.name,
          //       content: `CRITICAL_ERROR: Failed to spawn specialist: ${error.message}`,
          //     });
          //   }
          // }
          // @ts-expect-error
          const functionToCall = availableFunctions[functionName];
          const functionArgs = JSON.parse(toolCall.function.arguments);
          const functionResponse = functionToCall?.(functionArgs.location);
          return {
            role: "tool",
            content: functionResponse,
            tool_call_id: toolCall.id,
          };
        }),
      );

      // @ts-expect-error:
      messages.push(...toolCallResults);
      const finalResponse = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools,
        temperature: 0.5,
        tool_choice: "auto",
        max_completion_tokens: 4096,
      });

      const message = finalResponse.choices[0]?.message;
      return {
        content: message.content,
        tool_calls: message.tool_calls,
        role: message.role,
      };
    } catch (error: any) {
      throw new Error(`GROQ_GENERATION_FAILED: ${error.message}`);
    }
  }

  async generate(messages: ChatMessage[]): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as any,
        max_tokens: 2048,
        temperature: 0.2,
      });

      const message = response.choices[0]?.message;

      return {
        content: message.content,
        tool_calls: message.tool_calls,
        role: message.role,
      };
    } catch (error: any) {
      throw new Error(`GROQ_GENERATION_FAILED: ${error.message}`);
    }
  }
}
