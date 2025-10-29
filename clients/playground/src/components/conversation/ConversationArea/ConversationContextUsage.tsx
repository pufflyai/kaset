import type { ModelPricing } from "@/models";
import { Button, ProgressCircle, Stack, Text } from "@chakra-ui/react";
import { Tooltip, type UIMessage } from "@pstdio/kas-ui";
import { useEstimatedTokens } from "../hooks/useEstimatedTokens";

interface ConversationContextUsageProps {
  messages: UIMessage[];
  input: string;
  modelPricing?: ModelPricing;
}

export const ConversationContextUsage = (props: ConversationContextUsageProps) => {
  const { messages, input, modelPricing } = props;

  const tokenUsage = useEstimatedTokens(messages, input);
  const conversationTotalTokens = tokenUsage.conversationTotalTokens;
  const conversationPromptTokens = tokenUsage.conversationPromptTokens;

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
