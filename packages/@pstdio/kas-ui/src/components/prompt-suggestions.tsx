import { Button, Span, Stack, Text, type StackProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export interface PromptSuggestionItem {
  id?: string | number;
  summary: ReactNode;
}

export interface PromptSuggestionsProps extends Omit<StackProps, "children"> {
  suggestions?: PromptSuggestionItem[];
  onSelectSuggestion?: (suggestion: PromptSuggestionItem, index: number) => void;
  /** Icon element (or renderer) to display on the left side of each suggestion */
  icon?: ReactNode | ((index: number) => ReactNode);
  /** Disable interaction */
  isDisabled?: boolean;
  /** Limit the number of rendered suggestions */
  maxItems?: number;
}

/**
 * A dumb presentational list of prompt suggestions.
 * Renders each suggestion as a ghost button with an icon and one-line summary.
 */
export const PromptSuggestions = (props: PromptSuggestionsProps) => {
  const { suggestions = [], onSelectSuggestion, icon = <Sparkles size={16} />, isDisabled, maxItems, ...rest } = props;

  if (!suggestions || suggestions.length === 0) return null;

  const items = typeof maxItems === "number" ? suggestions.slice(0, Math.max(0, maxItems)) : suggestions;

  return (
    <Stack marginTop="sm" gap="0" {...rest}>
      {items.map((suggestion, index) => (
        <Stack key={suggestion.id ?? index} gap="0" role="group">
          <Button
            onClick={() => onSelectSuggestion?.(suggestion, index)}
            justifyContent="flex-start"
            variant="ghost"
            gap="xs"
            disabled={isDisabled}
          >
            <Span
              ml="-0.25rem"
              mr="xs"
              display="inline-flex"
              color="foreground.secondary"
              _groupHover={{ color: "foreground.primary" }}
            >
              {typeof icon === "function" ? icon(index) : icon}
            </Span>
            <Text
              lineClamp={1}
              color="foreground.secondary"
              textStyle="paragraph/M/regular"
              fontWeight="normal"
              _groupHover={{ color: "foreground.primary" }}
            >
              {suggestion.summary}
            </Text>
          </Button>
        </Stack>
      ))}
    </Stack>
  );
};
