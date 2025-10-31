import { readFile } from "@pstdio/opfs-utils";
import { shortUID } from "@pstdio/prompt-utils";
import type { BaseMessage, MessageHistory } from "@pstdio/tiny-ai-tasks";

export type AgentInstructions = {
  messages: MessageHistory;
  agentsPath: string | null;
};

export async function loadAgentInstructions(rootDir: string): Promise<AgentInstructions> {
  const messages: MessageHistory = [];
  const candidates = [`${rootDir}/agents.md`, `${rootDir}/AGENTS.md`];
  let agentsPath: string | null = null;

  for (const path of candidates) {
    try {
      const raw = await readFile(path);
      const content = raw?.trim();

      if (!content) {
        continue;
      }

      const systemAgents: BaseMessage & {
        id: string;
        meta: { tags: string[]; source: string };
      } = {
        id: `agents-${shortUID()}`,
        role: "system",
        content,
        meta: { tags: ["agents"], source: "agents.md" },
      };

      messages.push(systemAgents);
      agentsPath = path;
      break;
    } catch {
      // File does not exist; try next option.
    }
  }

  return { messages, agentsPath };
}
