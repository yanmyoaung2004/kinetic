import path from "path";

// ONLY these commands are allowed
// Add these to your WHITELIST in security.ts
const WHITELIST = [
  // File System
  "ls",
  "cat",
  "grep",
  "find",
  "du",
  // Networking (Windows & Unix)
  "ipconfig",
  "ifconfig",
  "ip",
  "ping",
  "netstat",
  "nslookup",
  "tracert",
  "traceroute",
  "curl",
  "ssh",
  // System Info
  "systeminfo",
  "tasklist",
  "uname",
  "hostname",
  "df",
  "free",
  "uptime",
  "whoami",
  // Net Tool
  "net",
];
// The only folder the agent is allowed to work in
export const WORKSPACE_PATH = path.join(process.cwd(), "agent_sandbox");

export function validate(command: string, args: string[]): void {
  if (!WHITELIST.includes(command)) {
    throw new Error(`SECURITY ALERT: Command '${command}' is not whitelisted.`);
  }
  // Prevent shell chaining and redirection characters
  const forbidden = /[;&|><$`\\]/;
  args.forEach((arg) => {
    if (forbidden.test(arg)) {
      throw new Error(`SECURITY ALERT: Illegal character in argument: ${arg}`);
    }
  });
}
export function isPathSafe(targetPath: string): boolean {
  const resolvedPath = path.resolve(WORKSPACE_PATH, targetPath);
  return resolvedPath.startsWith(WORKSPACE_PATH);
}
