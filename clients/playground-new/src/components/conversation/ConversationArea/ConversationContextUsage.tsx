import { Tooltip } from "@/components/ui/tooltip";
import { getModelPricing, type ModelPricing } from "@/models";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { Button, ProgressCircle, Stack, Text } from "@chakra-ui/react";
import type { UIMessage } from "@pstdio/kas/kas-ui";
import { useEffect, useState } from "react";
import { useEstimatedTokens } from "../hooks/useEstimatedTokens";

interface ConversationContextUsageProps {
  messages: UIMessage[];
  input: string;
}

export const ConversationContextUsage = (props: ConversationContextUsageProps) => {
  const { messages, input } = props;

  const tokenUsage = useEstimatedTokens(messages, input);
  const conversationTotalTokens = tokenUsage.conversationTotalTokens;
  const conversationPromptTokens = tokenUsage.conversationPromptTokens;

  const [modelPricing, setModelPricing] = useState<ModelPricing | undefined>(undefined);
  const modelId = useWorkspaceStore((state) => state.settings.modelId);

  useEffect(() => {
    setModelPricing(getModelPricing(modelId || undefined));
  }, [modelId]);

  const contextTokenUsage = conversationPromptTokens > 0 ? conversationPromptTokens : conversationTotalTokens;
  const contextTokenUsageDisplay = contextTokenUsage.toLocaleString();
  const contextWindowTokens = modelPricing?.contextWindow;
  const contextUsagePercent =
    contextWindowTokens && contextWindowTokens > 0 ? Math.min((contextTokenUsage / contextWindowTokens) * 100, 100) : 0;

  if (contextUsagePercent <= 0) return null;

  const contextPercentLabel = (() => {
    if (contextUsagePercent === 0) return "0%";
    if (contextUsagePercent >= 10) return `${Math.round(contextUsagePercent)}%`;
    if (contextUsagePercent >= 1) return `${contextUsagePercent.toFixed(1)}%`;
    return `${contextUsagePercent.toFixed(2)}%`;
  })();

  const tooltipContent = (
    <Stack gap="2xs" textStyle="body/XS">
      {contextWindowTokens !== undefined && (
        <Text>
          {contextTokenUsageDisplay} / {contextWindowTokens.toLocaleString()} tokens
        </Text>
      )}
    </Stack>
  );

  return (
    <Tooltip openDelay={0} closeDelay={0} content={tooltipContent}>
      <Button variant="ghost" size="2xs" _hover={{ background: "transparent" }}>
        <ProgressCircle.Root size="2xs" value={contextUsagePercent} max={100}>
          <ProgressCircle.Circle>
            <ProgressCircle.Track />
            <ProgressCircle.Range />
          </ProgressCircle.Circle>
        </ProgressCircle.Root>
        <Text textStyle="body/XS" color="foreground.secondary">
          {contextPercentLabel}
        </Text>
      </Button>
    </Tooltip>
  );
};
