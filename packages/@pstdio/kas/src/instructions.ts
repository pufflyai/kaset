import { readFile } from "@pstdio/opfs-utils";
import { shortUID } from "@pstdio/prompt-utils";
import type { UIMessage, UIConversation } from "./adapters/kas-ui/types";

export type AgentInstructions = {
  messages: UIConversation;
  agentsPath: string | null;
};

export async function loadAgentInstructions(rootDir: string): Promise<AgentInstructions> {
  const messages: UIConversation = [];
  const candidates = [`${rootDir}/agents.md`, `${rootDir}/AGENTS.md`];
  let agentsPath: string | null = null;

  for (const path of candidates) {
    try {
      const raw = await readFile(path);
      const content = raw?.trim();

      if (!content) {
        continue;
      }

      const systemAgents: UIMessage = {
        id: `agents-${shortUID()}`,
        role: "system",
        meta: { tags: ["agents"], source: "agents.md" },
        parts: [{ type: "text", text: content }],
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
