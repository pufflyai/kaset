import { Box, Flex, HStack, Spacer } from "@chakra-ui/react";
import { Send } from "lucide-react";
import { useState } from "react";
import { AttachDataMenu } from "./attach-data-menu";
import { PromptSuggestions } from "./prompt-suggestions";
import { ReferenceList } from "./reference-list";
import { PromptEditor } from "./rich-text/prompt-input/prompt-input";
import { SendButton } from "./send-button";

interface ChatInputProps {
  defaultState: string;
  onSubmit?: (text: string, attachments: string[]) => void;
  streaming?: boolean;
  suggestions?: Array<{ id: string; summary: string; prompt: string }>;
  onFileUpload?: () => Promise<string[] | undefined>;
  availableResources?: string[];
  attachedResources?: string[];
  onAttachResource?: (resourceId: string) => void;
  onDetachResource?: (resourceId: string) => void;
  onSelectResource?: (resourceId: string) => void;
  onClearAttachments?: () => void;
  isDisabled?: boolean;
}

export const ChatInput = (props: ChatInputProps) => {
  const {
    defaultState,
    onSubmit = () => {},
    streaming = false,
    suggestions = [],
    onFileUpload,
    availableResources = [],
    attachedResources = [],
    onAttachResource,
    onDetachResource,
    onSelectResource,
    onClearAttachments,
    isDisabled = false,
  } = props;
  const [isSelected, setIsSelected] = useState(false);
  const [text, setText] = useState("");

  const onSelect = () => {
    setIsSelected(true);
  };

  const handleSend = () => {
    if (streaming || isDisabled) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    onSubmit(trimmed, attachedResources);

    setText("");

    // Clear the references
    onClearAttachments?.();
  };

  const handleSelectSuggestion = (value: string) => {
    setText(value);
  };

  return (
    <Box
      width="100%"
      _hover={{
        borderColor: isSelected ? "border.accent" : "border.primary",
      }}
      onClick={onSelect}
      onBlur={() => setIsSelected(false)}
      paddingX="lg"
      paddingY="md"
      bg="background.primary"
      borderRadius="md"
      border={"1px solid transparent"}
      borderColor={isSelected ? "border.accent" : "border.secondary"}
      boxShadow={isSelected ? "4px 4px 0px 2px" : "none"}
      color="border.accent-light"
      transition="box-shadow 0.3s ease-in-out"
    >
      <Flex direction="column" color="foreground.primary">
        {attachedResources.length > 0 && (
          <ReferenceList references={attachedResources} onSelect={onSelectResource} onRemove={onDetachResource} />
        )}
        <PromptEditor defaultState={defaultState} onChange={(t) => setText(t)} onSubmit={handleSend} />
        <HStack gap="1" mt="md">
          <AttachDataMenu
            availableResources={availableResources}
            attachedResources={attachedResources}
            onAttach={onAttachResource}
            onFileUpload={onFileUpload}
            isDisabled={streaming || isDisabled}
          />
          <Spacer />
          <SendButton
            minW="3rem"
            icon={<Send size={16} />}
            title="Send Message"
            shortcut="Ctrl+⏎"
            onClick={handleSend}
            disabled={!text.trim() || streaming || isDisabled}
          />
        </HStack>
        {suggestions.length > 0 && !text.trim() && (
          <>
            <Spacer my="xs" />
            <PromptSuggestions
              suggestions={suggestions}
              onSelectSuggestion={(_, index) => handleSelectSuggestion(suggestions[index]?.prompt ?? "")}
            />
          </>
        )}
      </Flex>
    </Box>
  );
};
