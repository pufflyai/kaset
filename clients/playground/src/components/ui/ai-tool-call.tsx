import { Action } from "@/components/ui/action";
import { Icon } from "@/icons/Icon";
import type { ToolInvocation } from "@/types";
import { Box, HStack, Separator, Stack, Text } from "@chakra-ui/react";
import { Response } from "./ai-response";

const formatForDisplay = (value: any): string => {
  try {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
  } catch {
    return String(value);
  }
};

export const ToolInvocationView = (props: { invocation: ToolInvocation; streaming: boolean }) => {
  const { invocation, streaming } = props;

  const toolLabel = invocation.type?.replace(/^tool-/, "");

  const isError = (invocation as any).state === "output-error";
  const isDone = (invocation as any).state === "output-available";
  const isInputStreaming = (invocation as any).state === "input-streaming";
  const isInputAvailable = (invocation as any).state === "input-available";

  const providerExecuted = (invocation as any).providerExecuted === true;

  const input = (invocation as any).input;
  const output = (invocation as any).output;
  const errorText = (invocation as any).errorText as string | undefined;

  const statusText = isError
    ? "Error"
    : isDone
      ? "Done"
      : isInputStreaming
        ? "Running"
        : isInputAvailable
          ? providerExecuted
            ? "Running"
            : "Queued"
          : streaming
            ? "Running"
            : "Waiting";

  return (
    <Box width="full" bg="background.secondary" borderWidth="1px" borderColor="border.secondary" rounded="md" p="sm">
      <HStack justify="space-between" align="center" mb="xs">
        <HStack gap="2" align="center">
          <Icon name="plugin" size="xs" aria-label="Tool" />
          <Text textStyle="label/SM/regular">{toolLabel || "Tool"}</Text>
          <Text color="fg.secondary" textStyle="label/XS/regular">
            {invocation.toolCallId}
          </Text>
        </HStack>
        <HStack gap="0">
          {input != null && (
            <Action
              title="Copy input"
              icon={<Icon size="sm" name="copy" />}
              onClick={() =>
                navigator.clipboard.writeText(typeof input === "string" ? input : JSON.stringify(input, null, 2))
              }
            />
          )}
          {output != null && (
            <Action
              title="Copy output"
              icon={<Icon size="sm" name="copy" />}
              onClick={() =>
                navigator.clipboard.writeText(typeof output === "string" ? output : JSON.stringify(output, null, 2))
              }
            />
          )}
        </HStack>
      </HStack>

      <HStack mb="sm" color={isError ? "foreground.feedback.alert" : "foreground.secondary"}>
        <Icon name={isError ? "danger" : isDone ? "check" : "play"} size="xs" />
        <Text textStyle="label/XS/regular">{statusText}</Text>
        {providerExecuted && !isError && (
          <Text textStyle="label/XS/regular" color="foreground.tertiary">
            Provider executed
          </Text>
        )}
      </HStack>

      <Stack gap="sm">
        {input != null && (
          <Box>
            <Text textStyle="label/XS/regular" color="foreground.secondary" mb="xs">
              Input
            </Text>
            <Response parseIncompleteMarkdown={false}>{formatForDisplay(input)}</Response>
          </Box>
        )}

        {isError && errorText && (
          <Box>
            <Separator my="xs" />
            <Text textStyle="label/XS/regular" color="foreground.feedback.alert" mb="xs">
              Error
            </Text>
            <Response parseIncompleteMarkdown={false}>{errorText}</Response>
          </Box>
        )}

        {output != null && !isError && (
          <Box>
            <Separator my="xs" />
            <Text textStyle="label/XS/regular" color="foreground.secondary" mb="xs">
              Output
            </Text>
            <Response parseIncompleteMarkdown={false}>{formatForDisplay(output)}</Response>
          </Box>
        )}
      </Stack>
    </Box>
  );
};
