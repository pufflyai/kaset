import { createApprovalGate, createKasAgent, type Model, openaiModel } from "@pstdio/kas";
import type { UIConversation } from "@pstdio/kas/kas-ui";
import { decorateWithThought, toBaseMessages, toConversationUI, withClosedThoughts } from "@pstdio/kas/kas-ui";
import { createOpfsTools, loadAgentInstructions } from "@pstdio/kas/opfs-tools";
import { beginAgentRun, configureTracing, traceModel, traceTool } from "@pstdio/kas-tracing";
import { safeAutoCommit } from "@pstdio/opfs-utils";
import type { Tool } from "@pstdio/tiny-ai-tasks";
import { ROOT } from "@/constant";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { desktopTools } from "../desktop/tools";
import { requestApproval } from "./approval";
import { DEFAULT_WEBLLM_MODEL_ID, getWebLLMModel, isWebGPUAvailable } from "./webllm";

const rootDir = ROOT;

export async function* sendMessage(_conversationId: string, messages: UIConversation, extraTools: Tool[] = []) {
  const { settings } = useWorkspaceStore.getState();
  const approvalGatedTools = settings.approvalGatedTools ?? [];
  const provider = settings.provider ?? "openai";
  const apiKey = settings.apiKey;
  const baseUrl = settings.baseUrl;
  const modelId = settings.modelId ?? "gpt-5";

  configureTracing({
    enabled: !!settings.tracingEnabled,
    apiKey: settings.langsmithApiKey,
    project: settings.langsmithProject || "kaset",
    endpoint: settings.langsmithEndpoint || undefined,
  });

  const approvalGate = createApprovalGate({ approvalGatedTools, requestApproval });

  // load agents.md file
  const agentInstructions = await loadAgentInstructions(rootDir);

  const OPFSTools = createOpfsTools({ rootDir, approvalGate });

  const tools: Tool<any, any>[] = [...OPFSTools, ...desktopTools, ...extraTools];

  let model: Model;
  if (provider === "webllm") {
    if (!isWebGPUAvailable()) {
      throw new Error("WebLLM requires a WebGPU-capable browser (e.g. Chrome/Edge). No navigator.gpu found.");
    }
    model = getWebLLMModel(settings.webllmModelId || DEFAULT_WEBLLM_MODEL_ID);
  } else {
    model = openaiModel({
      model: modelId,
      apiKey: apiKey ?? "PLACEHOLDER_KEY",
      ...(baseUrl ? { baseUrl } : {}),
      dangerouslyAllowBrowser: true,
    });
  }

  const initialMessages = [...agentInstructions.messages, ...messages];
  const baseMessages = toBaseMessages(initialMessages);

  const traceHandle = beginAgentRun("kas-agent", { messages: baseMessages });

  const tracedModelId = provider === "webllm" ? settings.webllmModelId || DEFAULT_WEBLLM_MODEL_ID : modelId;
  const tracedModel = traceModel(model, { name: "llm", model: tracedModelId, provider, parent: traceHandle });
  const tracedTools = tools.map((tool) => traceTool(tool, { parent: traceHandle }));

  const agent = createKasAgent({ model: tracedModel, tools: tracedTools });

  const { messages: initialUIMessages, thought } = decorateWithThought(messages);

  yield initialUIMessages;

  try {
    for await (const ui of toConversationUI(agent(baseMessages))) {
      const next = withClosedThoughts([...initialUIMessages, ...ui], thought);
      yield next;
    }

    await traceHandle?.end({ status: "ok" });
  } catch (err) {
    await traceHandle?.error(err);
    throw err;
  }

  await safeAutoCommit({
    dir: rootDir,
    message: "AI updates",
    author: { name: "KAS", email: "kas@kaset.dev" },
  });
}
