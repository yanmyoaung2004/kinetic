import { KinetiCDispatcher } from "./dispatcher/AgentDispatcher";
import { KineticMemory } from "./memory/memory";

export class KineticOrchestrator {
  private memory: KineticMemory;
  private dispatcher: KinetiCDispatcher;

  constructor() {
    this.memory = new KineticMemory();
    this.dispatcher = new KinetiCDispatcher();
    this.dispatcher.loadAndRegisterAgent("./config/agents.json");
  }

  async process(userInput: string): Promise<string> {
    console.log("Kinetic Orchestrator: Initializing sequence...");

    try {
      // 1. Parallelize Intent Classification and User Record
      let context: any[] = [];
      const [decision, recallResult] = await Promise.all([
        this.memory.processUnifiedRoutingDecision(userInput),
        this.memory.recall(userInput),
        this.memory.record("user", userInput),
      ]);
      // console.log(decision.toolRequired)

      if (
        !decision.needMemory &&
        decision.targetAgent[0] === "NONE" &&
        decision.directAnswer
      ) {
        console.log("Direct Answer Path Taken");
        return decision.directAnswer;
      }

      // 2. Conditional Context Retrieval
      if (decision.needMemory) {
        context = recallResult;
      } else {
        console.log("⚡ Skip: Intent classified as 'New' or 'Social'.");
      }

      console.log(decision);
      const aiResponse = await this.dispatcher.dispatch(
        decision.targetAgent && decision.targetAgent.length > 0
          ? decision.targetAgent[0] === "NONE"
            ? "MainAgent"
            : decision.targetAgent[0]
          : "MainAgent",
        userInput,
        context,
        decision.toolRequired,
      );
      this.processPostResponse(aiResponse, context);
      return aiResponse;
    } catch (error) {
      console.error("Orchestrator Failure:", error);
      return "Systems offline. Even Stark has bad days. Check the logs.";
    }
  }

  async processPostResponse(aiResponse: string, context: any[]): Promise<void> {
    const MIN_LENGTH = 20;

    // Improved Echo Check: Check for similarity rather than just substring
    const isEcho = context.some(
      (m) =>
        aiResponse.length > 0 &&
        m.content
          .toLowerCase()
          .includes(aiResponse.toLowerCase().substring(0, 50)),
    );

    if (!isEcho && aiResponse.length > MIN_LENGTH) {
      await this.memory.record("assistant", aiResponse);
    } else {
      console.log("⚠️ Memory Guard: Redundancy detected. Record aborted.");
    }
  }
}
