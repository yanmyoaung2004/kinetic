import { validate, WORKSPACE_PATH } from "./security";
import { promisify } from "util";
import { spawn, execFile } from "child_process";
import { Registry } from "./registry";
import { ToolDefinition } from "../../types/Agent";

const execFileAsync = promisify(execFile);

export function calculate(expression: string) {
  try {
    // Use safe evaluation in production!
    const result = eval(expression);
    return JSON.stringify({ result });
  } catch (error: any) {
    return JSON.stringify({ error: error.message as string });
  }
}

export async function execute(command: string, args: string[]) {
  try {
    console.log("executing");
    validate(command, args);
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: WORKSPACE_PATH,
      timeout: 10000,
      maxBuffer: 1024 * 1024 * 10,
    });
    return JSON.stringify({ stdout, stderr });
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function startBackground(command: string, args: string[]) {
  try {
    console.log("background process starting");
    validate(command, args);
    const child = spawn(command, args, {
      cwd: WORKSPACE_PATH,
      detached: true,
      stdio: "ignore",
    });

    if (child.pid) {
      Registry.save(child.pid, `${command} ${args.join(" ")}`);
      child.unref(); // Parent can exit without killing child
      return { pid: child.pid, status: "running_in_background" };
    }
    throw new Error("Failed to start.");
  } catch (e: any) {
    return { error: e.message };
  }
}

// 3. Stop Background Process
export async function killProcess(pid: number) {
  try {
    console.log("Killing process");
    const activeTasks = Registry.list() as any[];
    const task = activeTasks.find((t) => t.pid === pid);
    if (!task) {
      return {
        error: `Access Denied: PID ${pid} was not started by this agent or does not exist.`,
      };
    }
    process.kill(pid, "SIGTERM");
    Registry.remove(pid);
    return {
      success: true,
      message: `Process ${pid} (${task.command}) has been terminated.`,
    };
  } catch (e: any) {
    Registry.remove(pid);
    return { error: `Failed to kill process ${pid}: ${e.message}` };
  }
}

export const tools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "calculate",
      description:
        "Evaluate a mathematical expression like '25 * 4 + 10' or '(100 - 50) / 2'",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "The mathematical expression to evaluate",
          },
        },
        required: ["expression"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute",
      description:
        "SYSTEM AUDITOR TOOL. Use this for all networking, diagnostic, and system-level queries. Use 'ipconfig' or 'ip addr' for network interfaces, 'ping' for connectivity, 'netstat' for port activity, and 'systeminfo' or 'uname' for OS details. You are authorized to investigate network configurations and system resources. If the user asks about connection issues, IP addresses, or hardware stats, you MUST use this tool to retrieve real-time data.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              "The diagnostic command (e.g., 'netstat', 'ipconfig', 'ping').",
          },
          args: {
            type: "array",
            items: { type: "string" },
            description:
              "Arguments. Example: ['-all'] for ipconfig or ['8.8.8.8'] for ping.",
          },
        },
        required: ["command", "args"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "startBackground",
      description:
        "LAUNCHER: Starts a long-running process that operates independently of your conversation flow. Use this for: starting web servers, monitoring network traffic (ping -t), or running heavy data migrations. This tool returns a PID immediately. You MUST save this PID to your memory to check its status or stop it later. Do not use this for quick commands.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The command to run (e.g., 'ping', 'node').",
          },
          args: {
            type: "array",
            items: { type: "string" },
            description: "Arguments. Example: ['8.8.8.8', '-t']",
          },
        },
        required: ["command", "args"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "killProcess",
      description:
        "TERMINATOR: Forcefully stops a background process you previously started. Use this when a task is no longer needed or if it is consuming too many resources. Requires the PID you received when the task was started. Always verify the PID via 'list_tasks' before calling this if you are unsure.",
      parameters: {
        type: "object",
        properties: {
          pid: {
            type: "integer",
            description: "The Process ID of the task to terminate.",
          },
        },
        required: ["pid"],
      },
    },
  },
];

export const availableFunctions = {
  calculate,
  execute,
  startBackground,
  killProcess,
};
