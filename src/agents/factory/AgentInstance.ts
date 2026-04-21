import { OllamaProvider } from "./../../providers/OllamaProvider";
import { GroqProvider } from "../../providers/GroqProvider";
import {
  AgentCard,
  IAgent,
  ChatMessage,
  ToolDefinition,
} from "../../types/Agent";
import { KinetiCDispatcher } from "../dispatcher/AgentDispatcher";
import { LLMProvider } from "../../types/BaseLLM";
import { OpenRouterProvider } from "../../providers/OpenRouterProvider";
import { tools } from "../tools/tools";

const SPAWN_SPECIALIST_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "spawn_specialist",
    description:
      "Creates a temporary specialized agent to handle a sub-task. Use this to delegate work to an expert (e.g., Coder, Auditor, Researcher, Creative Writer).",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "The role name (e.g., 'PythonExpert', 'SecurityAuditor')",
        },
        soul: {
          type: "string",
          description:
            "The system prompt/personality for this specialist. Be very specific about its constraints.",
        },
        model: {
          type: "string",
          enum: [
            "llama-3.1-8b-instant",
            // "llama-3.3-70b-versatile",
            "qwen/qwen3-32b",
          ],
          description:
            // "Choose 8b for speed/simple tasks, 70b for complex reasoning/reporting.",
            "Choose the model wisely",
        },
        task: {
          type: "string",
          description: "The specific message/task to send to this specialist.",
        },
      },
      required: ["name", "soul", "model", "task"],
    },
  },
};

export class AgentInstance implements IAgent {
  private llm: LLMProvider;
  private history: ChatMessage[] = [];
  private readonly MAX_ITERATIONS = 3; // Hard limit for safety

  private readonly GLOBAL_PROTOCOLS = `
# K.I.N.E.T.I.C. SYSTEM PROTOCOLS (MANDATORY)
- OUTPUT_FORMAT: Use professional Markdown with clear headers.
- TRUTH_ANCHOR: If data for a specific 2026 event is unavailable, state "DATA_GAP" and explain why. Never guess.
- AGENT_IDENTITY: Never state "As an AI language model." You are the role assigned in your Soul.
- CODE_BLOCKS: All code must be wrapped in triple backticks with the correct language tag. No emojis in code.
`;

  constructor(
    public id: string,
    public config: AgentCard,
    private dispatcher: KinetiCDispatcher,
  ) {
    switch (config.provider) {
      case "GROQ":
        this.llm = new GroqProvider(config.apiKey, config.model);
        break;
      case "OLLAMA":
        this.llm = new OllamaProvider(config.model);
        break;
      case "OPENROUTER":
        this.llm = new OpenRouterProvider(config.apiKey, config.model);
        break;
      default:
        // Default fallback to Groq if no match is found
        this.llm = new GroqProvider(config.apiKey, config.model);
    }

    const finalSoul = `${config.systemPrompt}\n${this.GLOBAL_PROTOCOLS}`;
    this.history.push({ role: "system", content: finalSoul });
    console.log(`[SYSTEM] Initialized: ${this.id} [${this.config.type}]`);
  }

  constructContextfulQuery(context: any[], query: string): string {
    if (context.length === 0) return query;

    const archives = context
      .map((m) => `- ${m.role.toUpperCase()}: ${m.content.slice(0, 500)}`) // Cap length
      .join("\n");

    return `${query}\n\n[ACCESSING ENCRYPTED ARCHIVES...]\nRelevant context:\n${archives}`;
  }

  async process(
    message: string,
    context: any[] = [],
    toolRequired: boolean = false,
    currentDepth: number = 0,
  ): Promise<string> {
    const MAX_DEPTH = 3;
    if (currentDepth > MAX_DEPTH) {
      return "ERROR: Maximum delegation depth reached. Task aborted.";
    }
    const refinedQuery = this.constructContextfulQuery(context, message);
    this.history.push({ role: "user", content: refinedQuery });
    const availableTools =
      this.config.type === "library" && this.config.can_delegate
        ? [...tools, SPAWN_SPECIALIST_TOOL]
        : tools;
    let response;
    if (toolRequired) {
      response = await this.llm.generateWithTools(
        this.history.filter(
          (msg) =>
            msg.role === "system" ||
            msg.role === "user" ||
            msg.role === "assistant",
        ) as any,
        availableTools,
      );
    } else {
      response = await this.llm.generate(
        this.history.filter(
          (msg) =>
            msg.role === "system" ||
            msg.role === "user" ||
            msg.role === "assistant",
        ) as any,
      );
    }
    // const response = await this.llm.generateWithTools(
    //     this.history.filter(
    //       (msg) =>
    //         msg.role === "system" ||
    //         msg.role === "user" ||
    //         msg.role === "assistant",
    //     ) as any,
    //     availableTools,
    //   );

    return response?.content || "Encountering error";
    // return "ERROR: Iteration limit exceeded. Agent failed to converge on a final answer.";

    // if (response.tool_calls) {
    //   const validCalls = response.tool_calls.filter(
    //     (call) => call.function.name === "spawn_specialist",
    //   );
    //   if (validCalls.length === 0 && response.content) {
    //     this.history.push({ role: "assistant", content: response.content });
    //     return response.content;
    //   }
    //   response.tool_calls = validCalls;
    // }
    // if (
    //   response.content &&
    //   (!response.tool_calls || response.tool_calls.length === 0)
    // ) {
    //   this.history.push({ role: "assistant", content: response.content });
    //   return response.content;
    // }
    // if (response.tool_calls && response.tool_calls.length > 0) {
    //   this.history.push({
    //     role: "assistant",
    //     content: response.content || "",
    //     tool_calls: response.tool_calls,
    //   } as any);
  }
}
