# K.I.N.E.T.I.C.

K.I.N.E.T.I.C. is an autonomous agentic framework engineered for high-precision technical tasks. It moves beyond simple prompting by implementing a **Dispatcher-Registry** model, allowing for a decoupled, scalable ecosystem where agents are treated as hot-swappable modules rather than static scripts.

## ⚡ The System Engine

The core of K.I.N.E.T.I.C. is defined by three operational pillars that separate the "brain" from the "tools."

### 1. The Dispatcher (The Brain)

The **KinetiCDispatcher** acts as the central nervous system. It handles:

- **Resource Arbitration:** Intelligent RAM management to prevent context overflow during heavy code indexing.
- **Agent Orchestration:** Routing tasks to the specific registered agent best suited for the objective.
- **Provider Switching:** Real-time failover between Groq, OpenRouter, and Ollama.

### 2. The Provider Nexus (The Connectivity)

A unified interface layer that abstracts the complexity of different LLM providers. Whether the system is running a local **Ollama** instance for privacy or **Groq** for sub-second inference, the internal API remains consistent.

### 3. The SOUL Layer (The Protocol)

Based on the `SOUL.md` manifesto, this layer governs the "personality" and behavioral constraints of the system. It ensures that every response is grounded, opinionated, and technically accurate, avoiding the fluff common in generic AI assistants.

## 🛠 Operational Workflow

1.  **Initialization:** The Kernel boots and loads the `SOUL` protocol.
2.  **Registry:** Specialized agents (e.g., Migration Agent, Security Auditor) register their capabilities with the Dispatcher.
3.  **Analysis:** The system uses integrated Search and Memory tools to index local documentation or remote codebases.
4.  **Execution:** The Dispatcher selects the optimal Provider/Agent combo to execute the engineering task.

## 🎯 Primary Objectives

- **Legacy Code Migration:** Utilizing specialized indexing to move antiquated stacks into modern TypeScript environments.
- **Security-First Development:** Built-in threat detection logic to audit code as it is generated.
- **High-Speed Iteration:** Leveraging LPU-based inference (Groq) for near-instantaneous agentic feedback loops.
