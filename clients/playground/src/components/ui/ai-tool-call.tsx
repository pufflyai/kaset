import { Action } from "@/components/ui/action";
import type { ToolInvocation } from "@pstdio/kas/kas-ui";
import { getIconComponent } from "@/utils/getIcon";
import { Box, HStack, Separator, Stack, Text } from "@chakra-ui/react";
import { CopyIcon } from "lucide-react";
import { Response } from "./ai-response";

const ToolIcon = getIconComponent("plugin");
const CopyOutputIcon = getIconComponent("copy");

const TOOL_ICON_SIZE = 16;
const STATUS_ICON_SIZE = 12;
const ACTION_ICON_SIZE = 12;

type ToolState = "input-streaming" | "input-available" | "output-available" | "output-error";
type StatusText = "Error" | "Done" | "Running" | "Queued" | "Waiting";

const formatForDisplay = (value: unknown): string => {
  try {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
  } catch {
    return String(value);
  }
};

function getStatusText(invocation: ToolInvocation, streaming: boolean): StatusText {
  const state: ToolState | undefined = "state" in invocation ? invocation.state : undefined;
  const providerExecuted = "providerExecuted" in invocation && invocation.providerExecuted === true;

  const baseByState: Partial<Record<ToolState, Exclude<StatusText, "Queued" | "Waiting">>> = {
    "output-error": "Error",
    "output-available": "Done",
    "input-streaming": "Running",
  };

  if (state === "input-available") return providerExecuted ? "Running" : "Queued";

  const base = state ? baseByState[state] : undefined;
  if (base) return base;

  return streaming ? "Running" : "Waiting";
}

export const ToolInvocationView = (props: { invocation: ToolInvocation; streaming: boolean }) => {
  const { invocation, streaming } = props;

  const toolLabel = invocation.type?.replace(/^tool-/, "");

  const state = "state" in invocation ? invocation.state : undefined;
  const isError = state === "output-error";
  const isDone = state === "output-available";

  const providerExecuted = "providerExecuted" in invocation && invocation.providerExecuted === true;
  const input = "input" in invocation ? invocation.input : undefined;
  const output = state === "output-available" && "output" in invocation ? invocation.output : undefined;
  const errorText = state === "output-error" && "errorText" in invocation ? invocation.errorText : undefined;
  const statusText = getStatusText(invocation, streaming);

  const StatusIcon = getIconComponent(isError ? "danger" : isDone ? "check" : "play");

  return (
    <Box width="full" bg="background.secondary" borderWidth="1px" borderColor="border.secondary" rounded="md" p="sm">
      <HStack justify="space-between" align="center" mb="xs">
        <HStack gap="sm" align="center">
          <ToolIcon size={TOOL_ICON_SIZE} aria-label="Tool" />
          <Text textStyle="label/SM/regular">{toolLabel || "Tool"}</Text>
          <Text color="fg.secondary" textStyle="label/XS/regular">
            {invocation.toolCallId}
          </Text>
        </HStack>
        <HStack gap="0">
          {input != null && (
            <Action
              title="Copy input"
              icon={<CopyIcon size={ACTION_ICON_SIZE} />}
              onClick={() =>
                navigator.clipboard.writeText(typeof input === "string" ? input : JSON.stringify(input, null, 2))
              }
            />
          )}
          {output != null && (
            <Action
              title="Copy output"
              icon={<CopyOutputIcon size={ACTION_ICON_SIZE} />}
              onClick={() =>
                navigator.clipboard.writeText(typeof output === "string" ? output : JSON.stringify(output, null, 2))
              }
            />
          )}
        </HStack>
      </HStack>

      <HStack mb="sm" color={isError ? "foreground.feedback.alert" : "foreground.secondary"}>
        <StatusIcon size={STATUS_ICON_SIZE} />
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
            <Response>{formatForDisplay(input)}</Response>
          </Box>
        )}

        {isError && errorText && (
          <Box>
            <Separator my="xs" />
            <Text textStyle="label/XS/regular" color="foreground.feedback.alert" mb="xs">
              Error
            </Text>
            <Response>{errorText}</Response>
          </Box>
        )}

        {output != null && !isError && (
          <Box>
            <Separator my="xs" />
            <Text textStyle="label/XS/regular" color="foreground.secondary" mb="xs">
              Output
            </Text>
            <Response>{formatForDisplay(output)}</Response>
          </Box>
        )}
      </Stack>
    </Box>
  );
};
