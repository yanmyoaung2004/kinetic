import path from "path";
import { readFile } from "fs/promises";
import { isPathSafe } from "../tools/security";

export async function readConfigMarkdown(filename: string) {
  try {
    // 1. Extension Guard
    if (!filename.endsWith(".md")) {
      throw new Error("Access Denied: Can only read .md files.");
    }

    // 2. Sandbox Escape Guard
    if (!isPathSafe(filename)) {
      throw new Error("Access Denied: Path is outside the sandbox.");
    }

    const WORKSPACE_PATH = path.join(process.cwd(), "agents/config");
    const fullPath = path.join(WORKSPACE_PATH, filename);
    const content = await readFile(fullPath, "utf-8");

    return { success: true, content };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
