import { Box, Flex, HStack, Spacer } from "@chakra-ui/react";
import { ArrowUp, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { AttachDataMenu } from "./attach-data-menu";
import { PromptSuggestions } from "./prompt-suggestions";
import { ReferenceList } from "./reference-list";
import { PromptEditor } from "./rich-text/prompt-input/prompt-input";
import { SendButton } from "./send-button";
import { generateEditorStateFromString, getTextFromSerializedEditorState } from "./rich-text/prompt-input/utils";

interface ChatInputProps {
  defaultState: string;
  onSubmit?: (text: string, attachments: string[]) => void;
  onInterrupt?: () => void;
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
  onChange?: (text: string) => void;
}

export const ChatInput = (props: ChatInputProps) => {
  const {
    defaultState,
    onSubmit = () => {},
    onInterrupt,
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
    onChange,
  } = props;
  const [isSelected, setIsSelected] = useState(false);
  const [editorState, setEditorState] = useState(defaultState);
  const [editorKey, setEditorKey] = useState(0);
  const [text, setText] = useState(() => getTextFromSerializedEditorState(defaultState));

  useEffect(() => {
    const resetText = getTextFromSerializedEditorState(defaultState);
    setEditorState(defaultState);
    setEditorKey((key) => key + 1);
    setText(resetText);
    onChange?.(resetText);
  }, [defaultState, onChange]);

  const onSelect = () => {
    setIsSelected(true);
  };

  const setEditorContent = (value: string) => {
    const nextState = JSON.stringify(generateEditorStateFromString(value));
    setEditorState(nextState);
    setEditorKey((key) => key + 1);
    setText(value);
    onChange?.(value);
  };

  const resetEditor = () => {
    setEditorState(defaultState);
    setEditorKey((key) => key + 1);
    const resetText = getTextFromSerializedEditorState(defaultState);
    setText(resetText);
    onChange?.(resetText);
  };

  const handleSend = () => {
    if (isDisabled) return;

    if (streaming) {
      onInterrupt?.();
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    onSubmit(trimmed, attachedResources);

    resetEditor();

    // Clear the references
    onClearAttachments?.();
  };

  const handleSelectSuggestion = (value: string) => {
    setEditorContent(value);
  };

  const canInterrupt = streaming && Boolean(onInterrupt);

  const sendIcon = streaming ? (
    <Square size={16} strokeWidth={2} fill="currentColor" />
  ) : (
    <ArrowUp size={16} strokeWidth={2} />
  );

  return (
    <Box
      width="100%"
      paddingX="lg"
      paddingY="md"
      bg="background.primary"
      borderRadius="md"
      borderWidth="1px"
      borderStyle="solid"
      borderColor={isSelected ? "border.accent" : "border.secondary"}
      boxShadow={isSelected ? "mid" : "low"}
      transition="box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out"
      _hover={{
        borderColor: isSelected ? "border.accent" : "border.primary",
        boxShadow: "mid",
      }}
      _focusWithin={{
        borderColor: "border.accent",
        boxShadow: "mid",
      }}
      onClick={onSelect}
      onBlur={() => setIsSelected(false)}
    >
      <Flex direction="column" color="foreground.primary">
        {attachedResources.length > 0 && (
          <ReferenceList references={attachedResources} onSelect={onSelectResource} onRemove={onDetachResource} />
        )}
        <PromptEditor
          key={editorKey}
          defaultState={editorState}
          onChange={(t) => {
            setText(t);
            onChange?.(t);
          }}
          onSubmit={handleSend}
        />
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
            icon={sendIcon}
            title={streaming ? (canInterrupt ? "Stop Response" : "Message Sending") : "Send Message"}
            shortcut={streaming ? undefined : "Ctrl+⏎"}
            onClick={handleSend}
            disabled={(streaming && !canInterrupt) || (!streaming && !text.trim()) || isDisabled}
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
