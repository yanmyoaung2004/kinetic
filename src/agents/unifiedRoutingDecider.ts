import Groq from "groq-sdk";
import ollama from "ollama";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { readConfigMarkdown } from "./utils/utils";

const UnifiedRoutingSchema = z.object({
  needMemory: z.boolean(),
  targetAgents: z.array(z.enum(["SecurityAnalyst", "NONE"])),
  executionMode: z.enum(["PARALLEL", "SEQUENTIAL"]),
});

export async function processUnifiedRoutingDecisionAPICallGroq(
  query: string,
  apiKey: string,
  model: string,
) {
  const groq = new Groq({ apiKey });
  const systemPromptObj = await readConfigMarkdown("./main/SYSTEMPROMPT.md");
  const systemPrompt =
    systemPromptObj.content ||
    `You are the K.I.N.E.T.I.C. Intelligence Router. Analyze user queries and 
    output ONLY the JSON routing instruction. DO NOT answer the user's question.\n\n`;

  try {
    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: query,
      },
    ];
    console.log("object");
    let response = await groq.chat.completions.create({
      model: model,
      include_reasoning: false,
      // @ts-expect-error
      messages: messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "decision",
          schema: {
            type: "object",
            properties: {
              needMemory: { type: "boolean" },
              targetAgent: {
                type: "array",
                items: { type: "string" },
              },
              executionMode: { type: "string" },
              directAnswer: { type: "string" },
            },
            required: ["needMemory", "targetAgents", "executionMode"],
            additionalProperties: false,
          },
        },
      },
      // tools,
      // tool_choice: "auto",
    });
    return JSON.parse(response.choices[0].message.content || "{}");
    // console.log(response.choices[0].message);

    // const maxIterations = 10;
    // let iteration = 0;
    // while (
    //   response.choices[0].message.tool_calls &&
    //   iteration < maxIterations
    // ) {
    //   iteration++;
    //   messages.push(response.choices[0].message);

    //   console.log(
    //     `Iteration ${iteration}: Model called ${response.choices[0].message.tool_calls.length} tool(s)`,
    //   );

    //   // Handle all tool calls from this turn
    //   for (const toolCall of response.choices[0].message.tool_calls) {
    //     const functionName = toolCall.function.name;
    //     const functionArgs = JSON.parse(toolCall.function.arguments);

    //     console.log(`  → ${functionName}(${JSON.stringify(functionArgs)})`);
    //     // @ts-expect-error:
    //     const functionToCall = availableFunctions[functionName];
    //     let functionResponse;

    //     if (functionName === "calculate") {
    //       functionResponse = functionToCall(functionArgs.expression);
    //     } else if (functionName === "execute") {
    //       functionResponse = await functionToCall(
    //         functionArgs.command,
    //         functionArgs.args,
    //       );
    //     } else if (functionName === "start_background") {
    //       functionResponse = await functionToCall(
    //         functionArgs.command,
    //         functionArgs.args,
    //       );
    //     } else if (functionName === "kill_process") {
    //       functionResponse = await functionToCall(functionArgs.pid);
    //     }

    //     console.log(`    ← ${functionResponse}`);

    //     // Add tool result to conversation
    //     messages.push({
    //       role: "tool",
    //       tool_call_id: toolCall.id,
    //       name: functionName,
    //       content: functionResponse,
    //     });
    //   }

    //   // Next turn with tool results
    //   // response = await groq.chat.completions.create({
    //   //   model: "openai/gpt-oss-120b",
    //   //   messages: messages,
    //   //   response_format: {
    //   //     type: "json_schema",
    //   //     json_schema: {
    //   //       name: "decision",
    //   //       schema: {
    //   //         type: "object",
    //   //         properties: {
    //   //           needMemory: { type: "boolean" },
    //   //           targetAgent: {
    //   //             type: "array",
    //   //             items: { type: "string" },
    //   //           },
    //   //           executionMode: { type: "string" },
    //   //           directAnswer: { type: "string" },
    //   //         },
    //   //         required: ["needMemory", "targetAgents", "executionMode"],
    //   //         additionalProperties: false,
    //   //       },
    //   //     },
    //   //   },
    //   //   tools,
    //   //   tool_choice: "auto",
    //   // });
    // }
    // console.log(`Assistant: ${response.choices[0].message.content}`);
  } catch (err) {
    console.error("Critical Routing Failure:", err);
    return {
      needMemory: false,
      targetAgents: ["NONE"],
      executionMode: "SEQUENTIAL",
    };
  }
}

// Refactored to handle "Thinking" blocks and raw conversational text
export async function processUnifiedRoutingDecisionAPICall(query: string) {
  const startTime = new Date().toISOString();
  // @ts-expect-error
  const jsonSchema = zodToJsonSchema(UnifiedRoutingSchema);

  try {
    const systemPrompt = `You are the K.I.N.E.T.I.C. Intelligence Router. 
        Analyze user queries and output ONLY the JSON routing instruction. 
        DO NOT answer the user's question.

        ### ONE-SHOT EXAMPLE:
        User: "How many CVEs are there?"
        Output: {
          "needMemory": false,
          "targetAgents": ["SecurityAnalyst"],
          "executionMode": "SEQUENTIAL"
        }

        AGENTS LIST ["SecurityAnalyst", "NONE"]
        NOW ONLY HAVE SECURITY. IF NO SPECIALIST AGENT IS NEEDED, RETURN "NONE".
        WHEN CHOOSING targetAgents, ONLY SELECT FROM THE AGENTS LIST. DO NOT INVENT NEW AGENTS.

        ### FIELD GUIDES:
        - needMemory: true if history retrieval is needed, else false.
        - targetAgents: Choose from [SECURITY, ANALYST, SOCIAL, NONE].
        - executionMode: SEQUENTIAL (default) or PARALLEL (for multiple tasks).`;

    const response = await ollama.chat({
      model: "gpt-oss:120b-cloud",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: query },
      ],
      format: jsonSchema,
      options: { temperature: 0 },
    });

    let rawContent = response.message.content;
    // 1. FIX: The gpt-oss model often returns reasoning inside <thought> or similar tags
    // This regex extracts the first valid { } block found in the response
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      rawContent = jsonMatch[0];
    }
    // 2. Parse and Validate
    const validatedData = UnifiedRoutingSchema.parse(JSON.parse(rawContent));
    const endTime = new Date().toISOString();
    console.log(
      `Ollama API Call Duration: ${new Date(endTime).getTime() - new Date(startTime).getTime()} ms`,
    );
    return validatedData;
  } catch (err) {
    console.error("Critical Routing Failure:", err);
    // 3. FAILSAFE: Always return a default object to keep the bot running
    return {
      needMemory: false,
      targetAgents: ["NONE"],
      executionMode: "SEQUENTIAL",
    };
  }
}

// const systemPrompt = `You are the K.I.N.E.T.I.C. Intelligence Router.
// Analyze user queries and output ONLY the JSON routing instruction.
// DO NOT answer the user's question.

// ONE EXCEPTION IS WHEN THE targetAgents IS "NONE" AND YOU DON'T NEED TO TO RETRIEVE ANY HISTORY OR INFORMATION TO ANSWER,
// THEN YOU CAN ANSWER THE USER'S QUESTION DIRECTLY WITHOUT CALLING ANY AGENT.
// IN THIS CASE, RETURN THE ANSWER IN THE "directAnswer" FIELD IN THE OUTPUT JSON.
// THIS IS THE ONLY CASE WHERE YOU SHOULD ANSWER THE USER'S QUESTION DIRECTLY.

// ### ONE-SHOT EXAMPLE:
// User: "How many CVEs are there?"
// Output: {
// "needMemory": false,
// "targetAgents": ["SecurityAnalyst"],
// "executionMode": "SEQUENTIAL"
// "directAnswer" : null
// }

// ### ONE-SHOT EXAMPLE:
// User: "Hello! How are you?"
// Output: {
// "needMemory": false,
// "targetAgents": ["None"],
// "executionMode": "SEQUENTIAL"
// "directAnswer" : "Hello! I'm doing great, thank you for asking. How can I assist you today?"
// }

// ### ONE-SHOT EXAMPLE:
// User: "Hello! what did we discuss yesterday?"
// Output: {
// "needMemory": true,
// "targetAgents": ["None"],
// "executionMode": "SEQUENTIAL"
// "directAnswer" : null"
// }

// AGENTS LIST ["SecurityAnalyst", "NONE"]
// NOW ONLY HAVE SECURITY. IF NO SPECIALIST AGENT IS NEEDED, RETURN "NONE".
// WHEN CHOOSING targetAgents, ONLY SELECT FROM THE AGENTS LIST. DO NOT INVENT NEW AGENTS.

// ### FIELD GUIDES:
// - needMemory: true if history retrieval is needed, else false.
// - targetAgents: Choose from [SECURITY, ANALYST, SOCIAL, NONE].
// - executionMode: SEQUENTIAL (default) or PARALLEL (for multiple tasks).`;
