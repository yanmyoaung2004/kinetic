import db from "./database.js";
import { pipeline } from "@xenova/transformers";
import { processUnifiedRoutingDecisionAPICallGroq } from "../unifiedRoutingDecider.js";
import { UnifiedRoutingDecision } from "../../types/Agent.js";

export class KineticMemory {
  private extractor: any = null;
  private DISTANCE_THRESHOLD = 19.0;

  async init() {
    if (!this.extractor) {
      // CPU-based embedding for zero GPU lag
      this.extractor = await pipeline(
        "feature-extraction",
        "Xenova/nomic-embed-text-v1",
      );
    }
  }

  private async getEmbedding(text: string): Promise<Float32Array> {
    await this.init();
    const output = await this.extractor(text, {
      pooling: "mean",
      normalize: true,
    });
    return new Float32Array(output.data);
  }

  /**
   * THE GATEKEEPER: Combines Heuristics and Gemma-2-2b
   */
  async processUnifiedRoutingDecision(
    userInput: string,
  ): Promise<UnifiedRoutingDecision> {
    const input = userInput.trim().toLowerCase();

    // 1. Hard-coded Fast Track (Regex) - Zero Latency
    const fastTrack = [
      "goal",
      "remember",
      "history",
      "access code",
      "last time",
      "project",
    ];
    // if (fastTrack.some((word) => input.includes(word)))
    //   return {
    //     needMemory: true,
    //     targetAgent: ["NONE"],
    //     executionMode: "SEQUENTIAL",
    //     directAnswer: null,
    //   };

    // // 2. Length & Filler Gate
    // if (
    //   input.length < 12 ||
    //   ["hello", "hi", "thanks", "cool"].includes(input)
    // ) {
    //   console.log("shouldn't be called");
    //   return {
    //     needMemory: false,
    //     targetAgent: ["NONE"],
    //     executionMode: "SEQUENTIAL",
    //     directAnswer: null,
    //   };
    // }

    // 3. Intelligent Intent Check
    try {
      const unifiedDecision = await processUnifiedRoutingDecisionAPICallGroq(
        userInput,
        process.env.GROQ_API_KEY!,
        "openai/gpt-oss-120b",
      );
      console.log("should be called : ", unifiedDecision);
      return {
        needMemory: unifiedDecision.needMemory,
        targetAgent: unifiedDecision.targetAgents,
        executionMode: unifiedDecision.executionMode,
        directAnswer: unifiedDecision.directAnswer || null,
        toolRequired: unifiedDecision.toolRequired || false,
      };
    } catch (err) {
      return {
        needMemory: true,
        targetAgent: ["NONE"],
        executionMode: "SEQUENTIAL",
        directAnswer: null,
        toolRequired: true,
      };
    }
  }

  async record(role: "user" | "assistant", content: string) {
    const embedding = await this.getEmbedding(content);
    return db.transaction(() => {
      const info = db
        .prepare("INSERT INTO messages (role, content) VALUES (?, ?)")
        .run(role, content);
      const newId = info.lastInsertRowid;

      db.prepare(
        "INSERT INTO vec_messages(rowid, embedding) VALUES (CAST(? AS INTEGER), ?)",
      ).run(newId, embedding);
      db.prepare(
        "INSERT INTO fts_messages(content, content_id) VALUES (?, ?)",
      ).run(content, newId);

      return newId;
    })();
  }

  async recall(query: string, limit: number = 5) {
    const queryVec = await this.getEmbedding(query);

    // Keyword Tokenization (OR Logic)
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .join(" OR ");

    const ftsQuery = keywords ? `"${keywords}"` : '""';

    // Hybrid Retrieval with Boosted User Scoring
    const vectorResults = db
      .prepare(
        `
        SELECT m.content, m.role, 'semantic' as source, 
        (v.distance - (CASE WHEN m.role = 'user' THEN 2.0 ELSE 0 END)) as score
        FROM vec_messages v JOIN messages m ON v.rowid = m.id
        WHERE embedding MATCH ? AND k = ? AND v.distance < ?
        ORDER BY score ASC
    `,
      )
      .all(queryVec, limit * 2, this.DISTANCE_THRESHOLD);

    const keywordResults =
      ftsQuery !== '""'
        ? db
            .prepare(
              `
        SELECT m.content, m.role, 'keyword' as source, 0 as score
        FROM fts_messages f JOIN messages m ON f.content_id = m.id
        WHERE fts_messages MATCH ? LIMIT ?
    `,
            )
            .all(ftsQuery, limit)
        : [];

    const combined = [...keywordResults, ...vectorResults];

    return Array.from(
      new Map(
        combined
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .map((item) => [item.content.trim().toLowerCase(), item]),
      ).values(),
    ).slice(0, limit);
  }
}
