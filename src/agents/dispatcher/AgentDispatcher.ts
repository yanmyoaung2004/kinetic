import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AgentInstance } from "../factory/AgentInstance.ts";
import { AgentCard, IAgent } from "../../types/Agent";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class KinetiCDispatcher {
  private registry: Map<string, AgentCard> = new Map();
  private activeAgents: Map<string, IAgent> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private childCounts: Map<string, number> = new Map();

  private readonly IDLE_TIMEOUT_MS = 30000;
  private readonly MAX_SUB_AGENTS = 3;
  private readonly DYNAMIC_DIR = path.resolve(
    process.cwd(),
    "agents_workspace",
  );
  private readonly GROQ_API_KEY = process.env.GROQ_API_KEY || "testing";

  constructor() {
    if (!this.GROQ_API_KEY) {
      throw new Error(
        "SYSTEM HALTED: GROQ_API_KEY environment variable is required.",
      );
    }
    if (!fs.existsSync(this.DYNAMIC_DIR)) {
      fs.mkdirSync(this.DYNAMIC_DIR, { recursive: true });
    }
  }

  loadAndRegisterAgent(customPath?: string) {
    const resolvedConfigPath =
      customPath || path.resolve(__dirname, "../../config/agents.json");

    if (!fs.existsSync(resolvedConfigPath)) {
      throw new Error(
        `[K.I.N.E.T.I.C ERROR] Could not find agents.json.\n` +
          `Attempted Path: ${resolvedConfigPath}\n` +
          `Current Directory (CWD): ${process.cwd()}\n` +
          `Dispatcher Directory: ${__dirname}`,
      );
    }

    const config = JSON.parse(fs.readFileSync(resolvedConfigPath, "utf-8"));
    const configDir = path.dirname(resolvedConfigPath);

    return config.registry.map((agentData: any) => {
      let systemPrompt = "You are a helpful K.I.N.E.T.I.C. agent.";

      if (agentData.soulPath) {
        const absoluteSoulPath = path.resolve(configDir, agentData.soulPath);

        if (fs.existsSync(absoluteSoulPath)) {
          systemPrompt = fs.readFileSync(absoluteSoulPath, "utf-8");
        } else {
          console.warn(
            `[!] Soul missing for ${agentData.id}: ${absoluteSoulPath}`,
          );
        }
      }

      const modelKey = agentData.model || config.settings.defaults.model;
      const finalModel = config.settings.aliases?.[modelKey] || modelKey;
      this.registerAgent({
        id: agentData.id,
        systemPrompt: systemPrompt,
        provider:
          agentData.provider || config.settings.defaults.provider || "GROQ",
        model: finalModel,
        type: agentData.type || config.settings.defaults.type || "library",
        apiKey: agentData.apiKey,
        can_delegate:
          agentData.can_delegate ??
          config.settings.defaults.can_delegate ??
          false,
      });
    });
  }

  registerAgent(card: AgentCard) {
    this.registry.set(card.id, card);
  }

  async createSubAgent(
    parentId: string,
    specs: { name: string; soul: string; model: string },
  ): Promise<string> {
    const parent = this.activeAgents.get(parentId);

    if (!parent || parent.config.type !== "library") {
      throw new Error(
        `FORBIDDEN: Agent ${parentId} lacks clearance to spawn sub-agents.`,
      );
    }

    const count = this.childCounts.get(parentId) || 0;
    if (count >= this.MAX_SUB_AGENTS) {
      throw new Error(
        `QUOTA_EXCEEDED: Maximum sub-agent limit reached for ${parentId}.`,
      );
    }

    const parnetInstance = this.registry.get(parentId);
    if (!parnetInstance) {
      throw new Error(`REGISTRY_ERROR: Parent agent ${parentId} not found.`);
    }

    const subId = `tmp_${specs.name}_${Date.now()}`;
    const subPath = path.join(this.DYNAMIC_DIR, subId);

    fs.mkdirSync(subPath, { recursive: true });
    fs.writeFileSync(path.join(subPath, "soul.md"), specs.soul);

    const card: AgentCard = {
      id: subId,
      systemPrompt: specs.soul,
      model: specs.model,
      type: "ephemeral",
      parentId: parentId,
      can_delegate: false,
      provider: "GROQ",
      apiKey: parnetInstance.apiKey,
    };

    fs.writeFileSync(path.join(subPath, "config.json"), JSON.stringify(card));
    this.registerAgent(card);
    this.childCounts.set(parentId, count + 1);

    return subId;
  }

  async dispatch(
    targetId: string,
    message: string,
    context: any[] = [],
    toolRequired: boolean,
    currentDepth: number = 0,
  ): Promise<string> {
    this.clearAgentTimeout(targetId);
    try {
      const agent = await this.getOrInitializeAgent(targetId);
      return await agent.process(message, context, toolRequired, currentDepth);
    } finally {
      this.scheduleEviction(targetId);
    }
  }

  private async getOrInitializeAgent(targetId: string): Promise<IAgent> {
    let agent = this.activeAgents.get(targetId);
    if (!agent) {
      const card = this.registry.get(targetId);
      if (!card)
        throw new Error(`REGISTRY_ERROR: Agent ${targetId} does not exist.`);
      agent = new AgentInstance(targetId, card, this);
      this.activeAgents.set(targetId, agent);
    }
    return agent;
  }

  private scheduleEviction(targetId: string) {
    this.clearAgentTimeout(targetId);
    this.timeouts.set(
      targetId,
      setTimeout(() => this.evict(targetId), this.IDLE_TIMEOUT_MS),
    );
  }

  private clearAgentTimeout(targetId: string) {
    const t = this.timeouts.get(targetId);
    if (t) {
      clearTimeout(t);
      this.timeouts.delete(targetId);
    }
  }

  private evict(targetId: string) {
    const agent = this.activeAgents.get(targetId);
    if (agent?.config.type === "ephemeral") {
      const targetPath = path.join(this.DYNAMIC_DIR, targetId);
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      }
      if (agent.config.parentId) {
        const c = this.childCounts.get(agent.config.parentId) || 1;
        this.childCounts.set(agent.config.parentId, c - 1);
      }
    }
    this.activeAgents.delete(targetId);
    console.log(`[MEMORY_MANAGER] Evicted: ${targetId}`);
  }
}
